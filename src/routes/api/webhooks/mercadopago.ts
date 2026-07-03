import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

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
          const status = payment.status;

          if (orderId && status) {
            let orderStatus: "paid" | "pending" | "canceled" = "pending";
            if (status === "approved") orderStatus = "paid";
            else if (status === "rejected" || status === "cancelled") orderStatus = "canceled";

            await supabaseAdmin.from("orders").update({ status: orderStatus }).eq("id", orderId);
          }
        } catch (err) {
          console.error("[webhook MP] erro ao processar:", err);
          // 200 mesmo assim evita retentativas infinitas por erro nosso pontual.
          return new Response("error handled", { status: 200 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
