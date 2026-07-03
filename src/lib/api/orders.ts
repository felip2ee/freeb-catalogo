import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Entrada da criação de pedido. O cliente envia APENAS productId + quantity:
// preço, nome e total são calculados no servidor a partir da tabela products.
const createOrderInput = z.object({
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
  paymentMethod: z.string().max(20).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderInput>;

// Pedido retornado pela RPC (snapshot de nome/preço já gravado).
export interface CreatedOrder {
  id: string;
  code: string;
  status: string;
  total: number;
  created_at: string;
  customer: { name: string; email: string; phone: string; cpf: string };
  items: {
    product_id: string;
    name: string;
    unit_price: number;
    quantity: number;
  }[];
}

// Server function: valida no servidor (Zod) e executa a RPC atômica via
// service_role. O handler e seus imports não vão para o bundle do cliente.
export const createOrder = createServerFn({ method: "POST" })
  .validator((data: unknown) => createOrderInput.parse(data))
  .handler(async ({ data }): Promise<CreatedOrder> => {
    const { supabaseAdmin } = await import("@/lib/supabase.server");

    const { data: order, error } = await supabaseAdmin.rpc("create_order", {
      p_customer: data.customer,
      p_items: data.items.map((i) => ({
        product_id: i.productId,
        quantity: i.quantity,
      })),
      p_payment_method: data.paymentMethod ?? null,
    });

    if (error) {
      // Erros conhecidos vindos da RPC (ex.: product_not_found, empty_cart).
      console.error("create_order RPC error:", error);
      throw new Error(error.message || "order_creation_failed");
    }

    return order as CreatedOrder;
  });
