-- Néctar Pura — schema inicial (Fase 0)
-- Tabelas: customers, products, orders, order_items + RLS + índices.
-- Aplicar no SQL Editor do Supabase ou via `supabase db push`.

create extension if not exists pgcrypto;

-- Helper para manter updated_at automático.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- CLIENTES — dados pessoais (LGPD): acesso restrito por RLS.
create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  phone       text not null,
  cpf         text not null unique,          -- chave de vínculo dos pedidos ao cliente
  created_at  timestamptz not null default now()
);

-- PRODUTOS — catálogo.
create table if not exists public.products (
  id           text primary key,             -- ex: "suco-laranja-600"
  name         text not null,
  description  text,
  volume       text,
  price        numeric(10,2) not null check (price >= 0),
  image_url    text,
  accent       text,                         -- orange | pink | gold | purple
  tag          text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- PEDIDOS — modo retirada no local (sem endereço/frete): total = subtotal.
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,       -- ex: "FB-XXXXX-1234" (gerado no servidor)
  customer_id     uuid not null references public.customers(id),
  status          text not null default 'pending'
                    check (status in ('pending','paid','preparing','delivered','canceled')),
  payment_method  text,                       -- pix | card | boleto
  total           numeric(10,2) not null check (total >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ITENS DO PEDIDO — snapshot de nome/preço no momento da compra.
create table if not exists public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  product_id  text not null references public.products(id),
  name        text not null,
  unit_price  numeric(10,2) not null check (unit_price >= 0),
  quantity    integer not null check (quantity > 0)
);

-- Índices.
create index if not exists idx_orders_customer      on public.orders(customer_id);
create index if not exists idx_orders_created        on public.orders(created_at);
create index if not exists idx_orders_status         on public.orders(status);
create index if not exists idx_order_items_order     on public.order_items(order_id);
create index if not exists idx_order_items_product   on public.order_items(product_id);

-- RLS habilitado em todas as tabelas. Políticas amplas (admin) virão na Fase 4.
alter table public.customers   enable row level security;
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Catálogo: leitura pública apenas de produtos ativos (necessário para a Fase 1).
create policy "products_public_read"
  on public.products for select
  using (active = true);

-- customers / orders / order_items: sem política para anon → negados por padrão.
--   • Criação de pedido virá pela RPC create_order (SECURITY DEFINER) na Fase 2.
--   • Acesso do admin (leitura/escrita) virá na Fase 4.
