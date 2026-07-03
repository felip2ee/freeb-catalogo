import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mapMpStatus } from "@/lib/mp-status";

// Webhook do Mercado Pago. O MP faz POST aqui quando um pagamento muda de estado
// (essencial para Pix/boleto, que confirmam de forma assíncrona).
// 🔒 Valida a assinatura HMAC-SHA256 antes de confiar na notificação.

export const Route = createFileRoute("/api/webhooks/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

        const url = new URL(request.url);
        const body = await request.json().catch(() => ({}) as Record<string, unknown>);

        // id do recurso (pagamento): vem na query (?data.id=) ou no corpo.
        const dataId =
          url.searchParams.get("data.id") ??
          (body as { data?: { id?: string | number } }).data?.id?.toString() ??
          "";
        const type = url.searchParams.get("type") ?? (body as { type?: string }).type ?? "";

        // ── Validação da assinatura ───────────────────────────────────────────
        if (secret) {
          const sig = request.headers.get("x-signature") ?? "";
          const requestId = request.headers.get("x-request-id") ?? "";
          const parts = Object.fromEntries(
            sig.split(",").map((p) => {
              const [k, v] = p.split("=");
              return [k?.trim(), v?.trim()];
            }),
          );
          const ts = parts["ts"];
          const v1 = parts["v1"];

          if (!ts || !v1) return new Response("missing signature", { status: 401 });

          const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
          const expected = createHmac("sha256", secret).update(manifest).digest("hex");

          const a = Buffer.from(expected);
          const b = Buffer.from(v1);
          if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return new Response("invalid signature", { status: 401 });
          }
        } else if (process.env.NODE_ENV === "production") {
          // 🔒 Fail-closed: sem secret em produção, nenhuma notificação é aceita.
          console.error(
            "[webhook MP] MERCADOPAGO_WEBHOOK_SECRET não definido em produção — notificação rejeitada.",
          );
          return new Response("webhook secret not configured", { status: 401 });
        } else {
          console.warn(
            "[webhook MP] MERCADOPAGO_WEBHOOK_SECRET não definido — pulando validação (apenas dev).",
          );
        }

        // Só tratamos notificações de pagamento.
        if (type !== "payment" || !dataId) {
          return new Response("ignored", { status: 200 });
        }

        try {
          const { mpPayment } = await import("@/lib/mercadopago.server");
          const { supabaseAdmin } = await import("@/lib/supabase.server");

          const payment = await mpPayment.get({ id: dataId });
          const orderId = payment.external_reference; // gravamos o order.id aqui
          const orderStatus = mapMpStatus(payment.status);

          // 'pending' e status desconhecidos não mexem no pedido (evita regredir
          // um pedido paid/preparing/delivered por notificação atrasada/duplicada).
          if (orderId && orderStatus && orderStatus !== "pending") {
            let query = supabaseAdmin
              .from("orders")
              .update({ status: orderStatus })
              .eq("id", orderId);
            // paid: só a partir de 'pending' (não volta preparing/delivered);
            // canceled (recusa/estorno/chargeback): vale para qualquer status.
            query =
              orderStatus === "paid"
                ? query.eq("status", "pending")
                : query.neq("status", "canceled");

            const { error } = await query;
            if (error) throw error;
          }
        } catch (err) {
          console.error("[webhook MP] erro ao processar:", err);
          const { logServerError } = await import("@/lib/log.server");
          await logServerError("webhook", err, { dataId, type });
          // 500 → o MP reenvia a notificação; sem isso uma falha momentânea do
          // banco perderia a confirmação do pagamento para sempre.
          return new Response("error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
