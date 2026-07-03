import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ⚠️ PROVISÓRIO (Fase 3): consulta o histórico apenas pelo CPF. É fraco — CPF é
// adivinhável, então qualquer um poderia ver os pedidos de outra pessoa. Antes de
// produção, trocar por verificação de posse do e-mail (magic link / OTP). Ver CLAUDE.md.

const historyInput = z.object({
  // aceita CPF com máscara; normaliza para 11 dígitos no handler
  cpf: z.string().trim().min(11).max(14),
});

export interface OrderHistoryItem {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
}

export interface OrderHistoryOrder {
  id: string;
  code: string;
  status: string;
  payment_method: string | null;
  total: number;
  created_at: string;
  items: OrderHistoryItem[];
}

export interface CustomerHistory {
  customer: { name: string; email: string; phone: string; cpf: string } | null;
  orders: OrderHistoryOrder[];
}

export const getCustomerHistory = createServerFn({ method: "POST" })
  .validator((data: unknown) => historyInput.parse(data))
  .handler(async ({ data }): Promise<CustomerHistory> => {
    const cpf = data.cpf.replace(/\D/g, "");
    if (cpf.length !== 11) return { customer: null, orders: [] };

    const { supabaseAdmin } = await import("@/lib/supabase.server");

    const { data: customer, error: cErr } = await supabaseAdmin
      .from("customers")
      .select("name,email,phone,cpf,id")
      .eq("cpf", cpf)
      .maybeSingle();

    if (cErr) {
      console.error("getCustomerHistory customer error:", cErr);
      throw new Error("history_lookup_failed");
    }
    if (!customer) return { customer: null, orders: [] };

    const { data: orders, error: oErr } = await supabaseAdmin
      .from("orders")
      .select(
        "id,code,status,payment_method,total,created_at,order_items(product_id,name,unit_price,quantity)",
      )
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    if (oErr) {
      console.error("getCustomerHistory orders error:", oErr);
      throw new Error("history_lookup_failed");
    }

    return {
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        cpf: customer.cpf,
      },
      orders: (orders ?? []).map((o) => ({
        id: o.id,
        code: o.code,
        status: o.status,
        payment_method: o.payment_method,
        total: Number(o.total),
        created_at: o.created_at,
        items: (o.order_items ?? []).map((it) => ({
          product_id: it.product_id,
          name: it.name,
          unit_price: Number(it.unit_price),
          quantity: it.quantity,
        })),
      })),
    };
  });
