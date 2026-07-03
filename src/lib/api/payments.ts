import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CreatedOrder } from "@/lib/api/orders";

// Dados que o Payment Brick envia no onSubmit (formData). Passamos adiante, mas
// o VALOR é sempre recalculado no servidor (nunca confiamos no amount do cliente).
const paymentInput = z
  .object({
    token: z.string().optional(),
    issuer_id: z.union([z.string(), z.number()]).optional(),
    payment_method_id: z.string(),
    installments: z.number().optional(),
    payer: z
      .object({
        email: z.string().email(),
        identification: z.object({ type: z.string(), number: z.string() }).optional(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

const checkoutInput = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(255),
    phone: z.string().trim().min(8).max(20),
    cpf: z.string().trim().min(11).max(14),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  payment: paymentInput,
});

export interface CheckoutResult {
  order: CreatedOrder;
  payment: {
    id: number | string | null;
    status: string; // approved | pending | in_process | rejected | ...
    statusDetail: string | null;
    method: "pix" | "card";
    pix: {
      qr_code: string | null;
      qr_code_base64: string | null;
      ticket_url: string | null;
    } | null;
  };
}

export const processCheckout = createServerFn({ method: "POST" })
  .validator((data: unknown) => checkoutInput.parse(data))
  .handler(async ({ data }): Promise<CheckoutResult> => {
    const { supabaseAdmin } = await import("@/lib/supabase.server");
    const { mpPayment } = await import("@/lib/mercadopago.server");

    const isPix = data.payment.payment_method_id === "pix";
    const method: "pix" | "card" = isPix ? "pix" : "card";

    // 1) Cria o pedido atômico (preço/total no banco) e obtém code + total.
    const { data: orderData, error: orderErr } = await supabaseAdmin.rpc("create_order", {
      p_customer: data.customer,
      p_items: data.items.map((i) => ({
        product_id: i.productId,
        quantity: i.quantity,
      })),
      p_payment_method: method,
    });
    if (orderErr) {
      console.error("create_order error:", orderErr);
      throw new Error(orderErr.message || "order_creation_failed");
    }
    const order = orderData as CreatedOrder;

    // 2) Cria o pagamento no Mercado Pago com o VALOR do servidor.
    const body: Record<string, unknown> = {
      transaction_amount: order.total,
      description: `Pedido ${order.code}`,
      external_reference: order.id,
      payment_method_id: data.payment.payment_method_id,
      payer: data.payment.payer ?? { email: data.customer.email },
    };
    if (data.payment.token) body.token = data.payment.token;
    if (data.payment.installments) body.installments = data.payment.installments;
    if (data.payment.issuer_id) body.issuer_id = data.payment.issuer_id;
    if (process.env.APP_URL) {
      body.notification_url = `${process.env.APP_URL}/api/webhooks/mercadopago`;
    }

    let mpStatus = "pending";
    let mpStatusDetail: string | null = null;
    let mpId: number | string | null = null;
    let pix: CheckoutResult["payment"]["pix"] = null;

    try {
      const res = await mpPayment.create({
        body,
        requestOptions: { idempotencyKey: order.id },
      });
      mpStatus = res.status ?? "pending";
      mpStatusDetail = res.status_detail ?? null;
      mpId = res.id ?? null;

      const tx = res.point_of_interaction?.transaction_data;
      if (isPix && tx) {
        pix = {
          qr_code: tx.qr_code ?? null,
          qr_code_base64: tx.qr_code_base64 ?? null,
          ticket_url: tx.ticket_url ?? null,
        };
      }
    } catch (err) {
      console.error("MP payment error:", err);
      // Pagamento falhou → marca o pedido como cancelado e propaga o erro.
      await supabaseAdmin.from("orders").update({ status: "canceled" }).eq("id", order.id);
      throw new Error("payment_failed");
    }

    // 3) Reflete o status do pagamento no pedido.
    //    Cartão aprovado → paid; recusado → canceled; Pix/pendente → pending
    //    (o webhook confirma o Pix depois).
    let orderStatus: "paid" | "pending" | "canceled" = "pending";
    if (mpStatus === "approved") orderStatus = "paid";
    else if (mpStatus === "rejected" || mpStatus === "cancelled") orderStatus = "canceled";

    await supabaseAdmin.from("orders").update({ status: orderStatus }).eq("id", order.id);

    return {
      order: { ...order, status: orderStatus },
      payment: {
        id: mpId,
        status: mpStatus,
        statusDetail: mpStatusDetail,
        method,
        pix,
      },
    };
  });
