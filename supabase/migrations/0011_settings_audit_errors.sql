-- FreeB — Feature 1: Configurações + Auditoria + Log de erros.
-- Rode no Supabase SQL Editor DEPOIS da 0010. Idempotente.
--
--   settings   → configs da loja (key/value): nome, WhatsApp, etc. Leitura
--                pública (usadas no storefront), escrita só admin.
--   audit_log  → quem (admin) mudou o quê (status de pedido, produto, categoria).
--                Preenchido por trigger; ignora escritas do sistema (service_role).
--   error_log  → erros de servidor (webhook, checkout) gravados via service_role.
--
-- Credenciais (MP etc.) NÃO ficam no banco — continuam no .env. O painel só mostra
-- um indicador "configurado / faltando" via server function (nunca o valor).

-- ── 1. Configurações da loja ─────────────────────────────────────────────────
create table if not exists public.settings (
  key         text primary key,
  value       text,
  updated_at  timestamptz not null default now()
);

alter table public.settings enable row level security;

drop policy if exists "settings_public_read" on public.settings;
create policy "settings_public_read"
  on public.settings for select
  using (true);

drop policy if exists "settings_admin_write" on public.settings;
create policy "settings_admin_write"
  on public.settings for all
  using (public.is_admin()) with check (public.is_admin());

-- Defaults (não sobrescreve valores já editados pelo admin).
insert into public.settings (key, value) values
  ('store_name',        'FreeB'),
  ('store_description', 'Sucos 100% naturais, do produtor à sua mesa. Trabalhamos com produtores locais e embalagens recicláveis.'),
  ('whatsapp',          ''),
  ('instagram',         ''),
  ('contact_email',     ''),
  ('pickup_address',    '')
on conflict (key) do nothing;

-- ── 2. Log de auditoria ──────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid,
  actor_email  text,
  action       text not null,             -- INSERT | UPDATE | DELETE
  entity       text not null,             -- nome da tabela
  entity_id    text,
  summary      text,                      -- descrição legível
  created_at   timestamptz not null default now()
);

alter table public.audit_log enable row level security;

drop policy if exists "audit_admin_read" on public.audit_log;
create policy "audit_admin_read"
  on public.audit_log for select
  using (public.is_admin());

create index if not exists idx_audit_created on public.audit_log(created_at desc);

-- Trigger genérico: registra a ação do admin logado. Escritas do sistema
-- (service_role — create_order, webhook, checkout) têm auth.uid() nulo e são
-- ignoradas, então o log fica só com "quem (admin) fez o quê".
create or replace function public.log_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      text;
  v_email   text;
  v_summary text;
begin
  if auth.uid() is null then
    if TG_OP = 'DELETE' then return old; else return new; end if;
  end if;

  if TG_OP = 'DELETE' then
    v_id := old.id::text;
  else
    v_id := new.id::text;
  end if;

  select email into v_email from auth.users where id = auth.uid();

  if TG_TABLE_NAME = 'orders' then
    -- Só interessa mudança de status (ignora updates de outros campos).
    if TG_OP = 'UPDATE' and old.status is not distinct from new.status then
      return new;
    end if;
    v_summary := coalesce(new.code, old.code)
      || case when TG_OP = 'UPDATE'
              then ': ' || old.status || ' → ' || new.status
              else '' end;
  elsif TG_TABLE_NAME in ('products', 'categories') then
    v_summary := coalesce(new.name, old.name);
  else
    v_summary := v_id;
  end if;

  insert into public.audit_log (actor_id, actor_email, action, entity, entity_id, summary)
  values (auth.uid(), v_email, TG_OP, TG_TABLE_NAME, v_id, v_summary);

  if TG_OP = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists audit_products on public.products;
create trigger audit_products
  after insert or update or delete on public.products
  for each row execute function public.log_audit();

drop trigger if exists audit_categories on public.categories;
create trigger audit_categories
  after insert or update or delete on public.categories
  for each row execute function public.log_audit();

drop trigger if exists audit_orders on public.orders;
create trigger audit_orders
  after update on public.orders
  for each row execute function public.log_audit();

-- ── 3. Log de erros de servidor ──────────────────────────────────────────────
create table if not exists public.error_log (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,              -- webhook | checkout | rpc | ...
  message     text not null,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

alter table public.error_log enable row level security;

drop policy if exists "error_admin_read" on public.error_log;
create policy "error_admin_read"
  on public.error_log for select
  using (public.is_admin());

create index if not exists idx_error_created on public.error_log(created_at desc);

-- Inserts em error_log vêm sempre de server functions com service_role
-- (bypassa RLS). anon/authenticated não escrevem aqui.
