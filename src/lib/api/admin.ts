import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Accent } from "@/lib/products";
import { isPaidStatus, type OrderStatus } from "@/lib/order-status";

// Operações do painel admin. Rodam no browser com a SESSÃO do admin — a RLS
// (is_admin) garante a segurança. Nada de service_role no cliente.

// ── Produtos ─────────────────────────────────────────────────────────────────
export interface AdminProduct {
  id: string;
  name: string;
  description: string | null;
  volume: string | null;
  price: number;
  image_url: string | null;
  accent: Accent | null;
  tag: string | null;
  active: boolean;
  category_id: string | null;
}

export interface ProductInput {
  id: string;
  name: string;
  description: string;
  price: number;
  category_id: string | null;
  accent: Accent;
  tag: string | null;
  image_url: string | null;
  volume: string; // rótulo do tamanho (nome da categoria)
  active: boolean;
}

export async function listAdminProducts(): Promise<AdminProduct[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,description,volume,price,image_url,accent,tag,active,category_id")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as AdminProduct[]).map((p) => ({ ...p, price: Number(p.price) }));
}

export async function createProduct(input: ProductInput): Promise<void> {
  const { error } = await supabase.from("products").insert(input);
  if (error) throw error;
}

export async function updateProduct(
  id: string,
  patch: Partial<Omit<ProductInput, "id">>,
): Promise<void> {
  const { error } = await supabase.from("products").update(patch).eq("id", id);
  if (error) throw error;
}

export async function setProductActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("products").update({ active }).eq("id", id);
  if (error) throw error;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

// ── Categorias (tamanhos) ────────────────────────────────────────────────────
export interface AdminCategory {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

export interface CategoryInput {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

export async function listAdminCategories(): Promise<AdminCategory[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,sort_order,active")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data as AdminCategory[];
}

export async function createCategory(input: CategoryInput): Promise<void> {
  const { error } = await supabase.from("categories").insert(input);
  if (error) throw error;
}

export async function updateCategory(
  id: string,
  patch: Partial<Omit<CategoryInput, "id">>,
): Promise<void> {
  const { error } = await supabase.from("categories").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}

// ── Pedidos ──────────────────────────────────────────────────────────────────
export interface AdminOrderItem {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  size: string | null;
}

export interface AdminOrderCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
}

export interface AdminOrder {
  id: string;
  code: string;
  status: OrderStatus;
  payment_method: string | null;
  total: number;
  created_at: string;
  customer: AdminOrderCustomer | null;
  items: AdminOrderItem[];
}

// Normaliza embeds (supabase-js tipa como array).
function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function listAdminOrders(): Promise<AdminOrder[]> {
  // Cancela pedidos 'pending' > 24h (Pix abandonado) antes de listar.
  // Ignora erro para não quebrar o painel se a migration 0008 ainda não rodou.
  await supabase.rpc("expire_stale_orders");

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id,code,status,payment_method,total,created_at,customer:customers(id,name,email,phone,cpf),order_items(product_id,name,unit_price,quantity,size)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((o) => {
    const row = o as Record<string, unknown>;
    return {
      id: row.id as string,
      code: row.code as string,
      status: row.status as OrderStatus,
      payment_method: (row.payment_method as string | null) ?? null,
      total: Number(row.total),
      created_at: row.created_at as string,
      customer: one(row.customer as AdminOrderCustomer | AdminOrderCustomer[] | null),
      items: ((row.order_items as AdminOrderItem[]) ?? []).map((it) => ({
        product_id: it.product_id,
        name: it.name,
        unit_price: Number(it.unit_price),
        quantity: it.quantity,
        size: it.size ?? null,
      })),
    };
  });
}

// Opções compartilhadas da lista de pedidos do admin: um único cache alimenta
// Dashboard, Pedidos e Clientes; staleTime evita refetch em cada troca de foco.
export const adminOrdersQuery = queryOptions({
  queryKey: ["admin", "orders"],
  queryFn: listAdminOrders,
  staleTime: 30_000,
});

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw error;
}

// ── Clientes (com agregados) ─────────────────────────────────────────────────
export interface CustomerStats {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

// Agrega no cliente a partir dos pedidos já em cache (adminOrdersQuery) — antes
// isso refazia um segundo full scan da tabela orders. Cada customer sempre tem
// >= 1 pedido, pois clientes são criados no checkout.
export function customerStatsFromOrders(orders: AdminOrder[]): CustomerStats[] {
  const map = new Map<string, CustomerStats>();
  for (const o of orders) {
    const c = o.customer;
    if (!c) continue;
    // totalSpent conta só pedido efetivamente pago; orderCount conta todos.
    const spent = isPaidStatus(o.status) ? o.total : 0;
    const existing = map.get(c.id);
    if (existing) {
      existing.orderCount += 1;
      existing.totalSpent += spent;
      if (!existing.lastOrderAt || o.created_at > existing.lastOrderAt) {
        existing.lastOrderAt = o.created_at;
      }
    } else {
      map.set(c.id, {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        cpf: c.cpf,
        orderCount: 1,
        totalSpent: spent,
        lastOrderAt: o.created_at,
      });
    }
  }

  return [...map.values()].sort((a, b) => b.totalSpent - a.totalSpent);
}
