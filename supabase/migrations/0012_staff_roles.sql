-- FreeB — Feature 2: Funcionários (papéis admin | staff) + RLS.
-- Rode no Supabase SQL Editor DEPOIS da 0011. Idempotente.
--
--   admin_users.role  → 'admin' (acesso total) | 'staff' (entregador).
--   is_admin()        → agora exige role = 'admin' (admins existentes continuam
--                       admin: a coluna nasce com default 'admin').
--   is_staff()        → role = 'staff'.
--   my_role()         → papel do usuário logado (ou null) — usado pelo guard.
--
--   Staff pode: LER pedidos/itens/clientes (para entregar) e mudar pedido de
--   'paid' → 'delivered' (WITH CHECK). NÃO acessa faturamento, produtos,
--   categorias, settings, logs nem cria pedidos/clientes.

-- ── 1. Coluna role + email (denormalizado p/ listar funcionários) ────────────
alter table public.admin_users
  add column if not exists role text not null default 'admin'
    check (role in ('admin', 'staff'));

alter table public.admin_users
  add column if not exists email text;

-- Backfill do e-mail dos usuários já existentes.
update public.admin_users a
  set email = u.email
  from auth.users u
  where u.id = a.user_id and a.email is null;

-- ── 2. Helpers de papel ──────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and role = 'staff'
  );
$$;

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.admin_users where user_id = auth.uid();
$$;

grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.my_role() to anon, authenticated;

-- ── 3. admin_users: admin gerencia todos; cada um lê a própria linha ──────────
drop policy if exists "admin_users_admin_all" on public.admin_users;
create policy "admin_users_admin_all"
  on public.admin_users for all
  using (public.is_admin()) with check (public.is_admin());

-- (self_read da 0003 continua valendo para o staff ler o próprio papel.)

-- ── 4. RLS de staff nas tabelas de operação ──────────────────────────────────
-- Pedidos: staff lê tudo; e só pode mudar de 'paid' → 'delivered'.
drop policy if exists "orders_staff_select" on public.orders;
create policy "orders_staff_select"
  on public.orders for select
  using (public.is_staff());

drop policy if exists "orders_staff_deliver" on public.orders;
create policy "orders_staff_deliver"
  on public.orders for update
  using (public.is_staff() and status = 'paid')
  with check (public.is_staff() and status = 'delivered');

-- Itens do pedido: staff lê (para saber o que entregar).
drop policy if exists "order_items_staff_select" on public.order_items;
create policy "order_items_staff_select"
  on public.order_items for select
  using (public.is_staff());

-- Clientes: staff lê (nome/telefone para a entrega). Não edita.
drop policy if exists "customers_staff_select" on public.customers;
create policy "customers_staff_select"
  on public.customers for select
  using (public.is_staff());

-- ── 5. expire_stale_orders: não quebra para staff (apenas não faz nada) ──────
create or replace function public.expire_stale_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  -- Só admin expira pedidos; para staff/sistema é no-op silencioso.
  if not public.is_admin() then
    return 0;
  end if;

  update public.orders
    set status = 'canceled'
    where status = 'pending'
      and created_at < now() - interval '24 hours';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_stale_orders() from public;
revoke all on function public.expire_stale_orders() from anon;
grant execute on function public.expire_stale_orders() to authenticated, service_role;
