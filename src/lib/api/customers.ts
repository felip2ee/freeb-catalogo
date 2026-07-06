import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Histórico do cliente por CPF + telefone (enquanto não há SMTP para OTP).
// O cliente prova posse informando o CPF E o telefone do cadastro — os dois
// precisam bater. CPF sozinho é adivinhável; exigir o telefone junto reduz o
// risco de alguém ver o histórico de outra pessoa.
// ⚠️ Ainda é um controle FRACO (não prova posse real do telefone). Migrar para
// OTP (e-mail/SMS via Supabase Auth) quando houver provedor configurado.

const myOrdersInput = z.object({
  cpf: z.string(),
  phone: z.string(),
});

export interface OrderHistoryItem {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  size: string | null;
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

const digits = (s: string) => s.replace(/\D/g, "");
// Telefone comparável: remove o código do país (55) quando presente, para
// comparar só DDD+número (o cadastro pode ter sido salvo com ou sem o 55).
const localPhone = (s: string) => {
  const d = digits(s);
  return d.length > 11 && d.startsWith("55") ? d.slice(2) : d;
};

export const getMyOrders = createServerFn({ method: "POST" })
  .validator((data: unknown) => myOrdersInput.parse(data))
  .handler(async ({ data }): Promise<CustomerHistory> => {
    const { assertRateLimit } = await import("@/lib/rate-limit.server");
    // Limite global — dificulta força bruta de CPF+telefone.
    assertRateLimit("my-orders", 20, 60_000);

    const cpf = digits(data.cpf);
    const phone = localPhone(data.phone);
    if (cpf.length !== 11) throw new Error("invalid_cpf");
    if (phone.length < 10) throw new Error("invalid_phone");

    const { supabaseAdmin } = await import("@/lib/supabase.server");

    // CPF é único em customers → 0 ou 1 cadastro.
    const { data: customer, error: cErr } = await supabaseAdmin
      .from("customers")
      .select("id,name,email,phone,cpf")
      .eq("cpf", cpf)
      .maybeSingle();

    if (cErr) {
      console.error("getMyOrders customer error:", cErr);
      throw new Error("history_lookup_failed");
    }

    // Não encontrado OU telefone não confere → mesma resposta vazia
    // (não revela se aquele CPF existe no banco).
    if (!customer || localPhone(customer.phone) !== phone) {
      return { customer: null, orders: [] };
    }

    const { data: orders, error: oErr } = await supabaseAdmin
      .from("orders")
      .select(
        "id,code,status,payment_method,total,created_at,order_items(product_id,name,unit_price,quantity,size)",
      )
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    if (oErr) {
      console.error("getMyOrders orders error:", oErr);
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
          size: it.size ?? null,
        })),
      })),
    };
  });
