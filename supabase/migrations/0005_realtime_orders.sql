-- Néctar Pura — habilita Supabase Realtime na tabela orders (Fase 5, dashboard).
-- Assim o painel recebe novos pedidos ao vivo. A RLS continua valendo: só admins
-- (is_admin) recebem os eventos.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
