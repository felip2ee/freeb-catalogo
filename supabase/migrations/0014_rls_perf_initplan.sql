-- FreeB — Performance: RLS initplan em admin_users_self_read.
-- Rode no SQL Editor DEPOIS da 0013. Idempotente.
--
--   O linter (auth_rls_initplan) aponta que `auth.uid()` cru é reavaliado por
--   linha. Envolver em `(select auth.uid())` faz o Postgres avaliar UMA vez
--   (initplan) e reusar. Mesma semântica, só mais rápido.
--
--   Os avisos `multiple_permissive_policies` NÃO são corrigidos aqui: são
--   inerentes ao design (admin + staff na mesma ação SELECT), estão corretos,
--   e consolidá-los triplicaria as policies de escrita sem ganho relevante na
--   escala atual.

drop policy if exists "admin_users_self_read" on public.admin_users;
create policy "admin_users_self_read"
  on public.admin_users for select
  using ((select auth.uid()) = user_id);
