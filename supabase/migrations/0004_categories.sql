-- Néctar Pura — Categorias por tamanho (500ml, 300ml, 1L, 5L)
-- "Categoria" aqui = tamanho/volume do produto. Um produto pertence a um tamanho.

-- ── Tabela de categorias (tamanhos) ──────────────────────────────────────────
create table if not exists public.categories (
  id          text primary key,          -- slug, ex: "500ml", "1l"
  name        text not null,             -- rótulo exibido, ex: "500ml", "1 litro"
  sort_order  int  not null default 0,   -- ordena os filtros na loja
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.categories enable row level security;

-- Leitura pública apenas das categorias ativas (loja).
drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read"
  on public.categories for select
  using (active = true);

-- Escrita só admin.
drop policy if exists "categories_admin_write" on public.categories;
create policy "categories_admin_write"
  on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

-- ── Vínculo produto → categoria (tamanho) ────────────────────────────────────
alter table public.products
  add column if not exists category_id text references public.categories(id);

create index if not exists idx_products_category on public.products(category_id);

-- ── Seed dos tamanhos ────────────────────────────────────────────────────────
insert into public.categories (id, name, sort_order) values
  ('300ml', '300ml',    10),
  ('500ml', '500ml',    20),
  ('1l',    '1 litro',  30),
  ('5l',    '5 litros', 40)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- ── Backfill: normaliza os 4 produtos demo (eram 600ml) para 500ml ───────────
-- Só ajusta os que ainda não têm categoria, para o filtro da loja já funcionar.
update public.products
  set category_id = '500ml', volume = '500ml'
  where category_id is null;
