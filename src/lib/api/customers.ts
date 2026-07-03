import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Histórico do cliente com verificação de posse do e-mail (Supabase Auth OTP).
// Fluxo: o cliente pede um código por e-mail (signInWithOtp), digita o código
// (verifyOtp) e o navegador envia o access_token da sessão para cá. O servidor
// valida o token e busca os pedidos dos cadastros ligados àquele e-mail.
// Substitui a consulta por CPF (CPF é adivinhável — qualquer um veria o
// histórico de outra pessoa).

const myOrdersInput = z.object({
  accessToken: z.string().min(20),
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

// O e-mail é verificado, mas o cadastro pode ter sido criado por terceiro com
// e-mail digitado errado — CPF/telefone continuam mascarados por precaução.
const maskCpf = (cpf: string) => `***.***.***-${cpf.slice(-2)}`;
const maskPhone = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  return d.length >= 4 ? `*****${d.slice(-4)}` : "****";
};

export const getMyOrders = createServerFn({ method: "POST" })
  .validator((data: unknown) => myOrdersInput.parse(data))
  .handler(async ({ data }): Promise<CustomerHistory> => {
    const { assertRateLimit } = await import("@/lib/rate-limit.server");
    assertRateLimit("my-orders", 20, 60_000);

    const { supabaseAdmin } = await import("@/lib/supabase.server");

    // Valida o token e extrai o e-mail comprovado pelo OTP.
    const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    const email = userData?.user?.email;
    if (authErr || !email) throw new Error("not_authenticated");

    // ilike sem curinga = igualdade case-insensitive. Um mesmo e-mail pode ter
    // mais de um cadastro (CPFs diferentes) — agregamos todos.
    const { data: customers, error: cErr } = await supabaseAdmin
      .from("customers")
      .select("id,name,email,phone,cpf,created_at")
      .ilike("email", email)
      .order("created_at", { ascending: false });

    if (cErr) {
      console.error("getMyOrders customers error:", cErr);
      throw new Error("history_lookup_failed");
    }
    if (!customers || customers.length === 0) return { customer: null, orders: [] };

    const { data: orders, error: oErr } = await supabaseAdmin
      .from("orders")
      .select(
        "id,code,status,payment_method,total,created_at,order_items(product_id,name,unit_price,quantity,size)",
      )
      .in(
        "customer_id",
        customers.map((c) => c.id),
      )
      .order("created_at", { ascending: false });

    if (oErr) {
      console.error("getMyOrders orders error:", oErr);
      throw new Error("history_lookup_failed");
    }

    const latest = customers[0];
    return {
      customer: {
        name: latest.name,
        email,
        phone: maskPhone(latest.phone),
        cpf: maskCpf(latest.cpf),
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
