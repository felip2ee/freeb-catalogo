-- Néctar Pura — Autenticação e segurança do admin (Fase 4)
-- Cria admin_users, helper is_admin() e políticas RLS de admin nas tabelas.
-- Admins são usuários do Supabase Auth cujo id está em admin_users.

-- ── Tabela que marca quem é admin ────────────────────────────────────────────
create table if not exists public.admin_users (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Cada usuário lê apenas a própria linha (o guard usa isso para saber se é admin).
drop policy if exists "admin_users_self_read" on public.admin_users;
create policy "admin_users_self_read"
  on public.admin_users for select
  using (auth.uid() = user_id);

-- ── Helper: o usuário logado é admin? ────────────────────────────────────────
-- SECURITY DEFINER para poder checar admin_users independentemente da RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ── Políticas RLS de admin nas tabelas de negócio ────────────────────────────
-- customers / orders / order_items: leitura e escrita totais apenas para admins.
-- (A criação de pedido pelo cliente continua via RPC create_order SECURITY DEFINER,
--  e o histórico por CPF via server function com service_role — ambos independem
--  destas políticas.)
drop policy if exists "customers_admin_all" on public.customers;
create policy "customers_admin_all"
  on public.customers for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all"
  on public.orders for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "order_items_admin_all" on public.order_items;
create policy "order_items_admin_all"
  on public.order_items for all
  using (public.is_admin()) with check (public.is_admin());

-- products: leitura pública (policy products_public_read já existe);
-- escrita (insert/update/delete) apenas admin.
drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write"
  on public.products for all
  using (public.is_admin()) with check (public.is_admin());
