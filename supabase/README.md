# Supabase — FreeB

Schema e seed do banco. Modelagem completa em [../CLAUDE.md](../CLAUDE.md) (Seção 4).

## Arquivos

- `migrations/0001_init.sql` — tabelas (`customers`, `products`, `orders`,
  `order_items`), índices, RLS habilitado e leitura pública do catálogo ativo.
- `migrations/0002_create_order.sql` — RPC `create_order` (atômica,
  `SECURITY DEFINER`): upsert do cliente por CPF, preço/total calculados no banco
  e `code` único gerado no servidor. Execução liberada só para `service_role`.
- `migrations/0003_admin_rls.sql` — `admin_users`, helper `is_admin()` e políticas
  RLS de admin (leitura/escrita de pedidos/clientes; escrita de produtos).
- `migrations/0004_categories.sql` — `categories` (tamanhos: 300ml/500ml/1L/5L),
  `products.category_id` + RLS. Normaliza os 4 produtos demo para 500ml.
- `migrations/0005_realtime_orders.sql` — habilita Supabase Realtime na tabela
  `orders` (dashboard ao vivo).
- `seed.sql` — os 4 sucos iniciais (idempotente).

## Como aplicar (fase de desenvolvimento)

### Opção A — SQL Editor (mais rápido)

1. Crie um projeto em https://supabase.com.
2. Em **Project Settings → API**, copie `Project URL` e a `anon public key`.
3. Copie `.env.example` para `.env` (na raiz do projeto) e preencha
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. No painel do Supabase, abra **SQL Editor** e rode, nesta ordem:
   - o conteúdo de `migrations/0001_init.sql`
   - o conteúdo de `migrations/0002_create_order.sql`
   - o conteúdo de `migrations/0003_admin_rls.sql`
   - o conteúdo de `migrations/0004_categories.sql`
   - o conteúdo de `migrations/0005_realtime_orders.sql`
   - o conteúdo de `seed.sql`

## Criar o usuário admin (Fase 4)

1. Rode a migration `0003_admin_rls.sql` (passo acima).
2. No painel: **Authentication → Users → Add user** — informe e-mail e senha e
   marque **Auto Confirm User** (senão o login exige confirmação por e-mail).
3. Marque esse usuário como admin no **SQL Editor**:
   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where email = 'SEU-EMAIL-ADMIN@exemplo.com'
   on conflict (user_id) do nothing;
   ```
4. Acesse `/admin/login` no app e entre com esse e-mail/senha.

### Opção B — Supabase CLI

```bash
supabase link --project-ref SEU_REF
supabase db push          # aplica as migrations
# rodar o seed.sql manualmente (SQL Editor) ou via psql
```

## Próximos passos do banco

- **Fase 2:** função `create_order` (RPC, `SECURITY DEFINER`) para criar pedidos
  de forma atômica, calculando preço/total a partir da tabela `products`.
- **Fase 4:** políticas RLS de admin (leitura/escrita de pedidos e clientes).

## Storage (imagens dos produtos)

Subir as imagens de `src/assets/*.jpg` para um bucket público e preencher
`products.image_url`. Enquanto isso, `image_url` fica `null` e o front usa as
imagens locais como fallback (ajuste na Fase 1).
