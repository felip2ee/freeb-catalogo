# Néctar Pura — Plano de Ação: Backend, Painel Admin e Pedidos Vinculados

> Documento de orientação para o desenvolvimento. Define o estado atual, o objetivo
> e o passo a passo para evoluir o catálogo de um protótipo client-side para um
> app full-stack com persistência de pedidos, histórico por cliente e painel
> administrativo com relatórios.

---

## 1. Visão geral do projeto

**Néctar Pura** é um catálogo online de sucos naturais (600ml) que permite compras.
Stack atual:

- **Framework:** TanStack Start (SSR) + React 19 + TypeScript
- **Roteamento:** TanStack Router (file-based em `src/routes/`)
- **UI:** Tailwind CSS v4 + shadcn/ui (Radix) + lucide-react + sonner (toasts)
- **Estado de servidor:** TanStack Query (já instalado, ainda subutilizado)
- **Validação:** Zod + react-hook-form
- **Gráficos:** recharts (já instalado — será usado no admin)
- **Origem do frontend:** scaffolding inicial gerado no Lovable (apenas o front).
  O backend, o banco e o deploy **não** dependem do Lovable.
- **Banco (dev):** Supabase
- **Deploy:** Docker administrado via Portainer (ver Seção 7). Ferramentas extras
  de produção (proxy, etc.) serão instaladas no momento de ir para produção.

### Estado atual (importante)

- Produtos são **estáticos** em [src/lib/products.ts](src/lib/products.ts) (4 sucos hardcoded).
- Carrinho vive no **`localStorage`** ([src/contexts/CartContext.tsx](src/contexts/CartContext.tsx)).
- O checkout é **simulado**: ao confirmar, o pedido é gravado só no
  **`sessionStorage`** do navegador ([src/routes/checkout.tsx](src/routes/checkout.tsx) →
  `saveLastOrder` em [src/routes/obrigado.tsx](src/routes/obrigado.tsx)).
- **Não há backend nem banco de dados.** Os pedidos nunca saem do dispositivo do
  cliente. Mercado Pago está marcado como "próxima etapa".

> ⚠️ Consequência: hoje é **impossível** um painel admin acompanhar vendas, porque
> não existe nenhum lugar central onde os pedidos sejam armazenados. Persistir os
> pedidos é o pré-requisito de tudo.

---

## 2. Objetivos

1. **Persistir pedidos** num banco de dados (Supabase / Postgres).
2. **Pedidos vinculados ao cliente:** todo pedido é amarrado a um cadastro de
   cliente (identificado por CPF/e-mail), permitindo ver o histórico completo de
   compras de cada pessoa.
3. **Painel administrativo** (`/admin`, rota protegida por login) para acompanhar
   vendas e pedidos em tempo real.
4. **Relatórios:** faturamento por período, produtos mais vendidos, ticket médio,
   pedidos por status e por cliente, com exportação (CSV).

---

## 3. Decisões de arquitetura (já definidas)

| Decisão | Escolha | Motivo |
|---|---|---|
| Backend / banco | **Supabase** (Postgres + Auth + APIs) | Postgres + Auth + Storage prontos; full-stack rápido na fase de dev |
| Significado de "pedidos vinculados" | **Cliente com vários pedidos** (histórico) | Cada pedido referencia um `customer` |
| Acesso ao admin | **Rota `/admin` protegida no mesmo app** | Um único deploy, mais simples de manter |
| Hospedagem | **Docker gerenciado via Portainer** | App SSR roda como container; deploy por stack |

---

## 4. Modelagem de dados (Supabase / Postgres)

> Tabelas em `snake_case`. Toda escrita protegida por **RLS** (Row Level Security).
> Produtos passam a viver no banco (mantendo os 4 atuais como seed) para que preços
> e catálogo possam ser geridos sem deploy.
>
> **Modo de entrega: retirada no local.** Não há endereço de entrega nem frete —
> por isso `orders` não tem `shipping_fee`/endereço e `total = subtotal`. Se um dia
> passar a entregar, adicionar `delivery_address` + `shipping_fee` e separar
> subtotal/total. (Ajuste de UI relacionado: trocar o texto *"Frete — calculado no
> checkout"* em [carrinho.tsx](src/routes/carrinho.tsx) por *"Retirada no local"*.)
>
> **LGPD:** `customers` guarda dados pessoais (nome, CPF, e-mail, telefone). Manter
> acesso restrito só a admin via RLS, registrar consentimento no checkout e definir
> política de retenção. Nunca expor esses dados em endpoints públicos sem a
> verificação da Fase 3.

```
customers
  id            uuid  PK  default gen_random_uuid()
  name          text  not null
  email         text  not null
  phone         text  not null
  cpf           text  not null  unique      -- chave de vínculo do cliente
  created_at    timestamptz default now()

products
  id            text  PK                     -- ex: "suco-laranja-600"
  name          text  not null
  description   text
  volume        text
  price         numeric(10,2) not null
  image_url     text
  accent        text                         -- orange | pink | gold | purple
  tag           text
  active        boolean default true
  created_at    timestamptz default now()

orders
  id            uuid  PK  default gen_random_uuid()
  code          text  not null unique        -- ex: "NP-XXXXX-1234"
  customer_id   uuid  FK -> customers(id) not null   -- VÍNCULO do pedido ao cliente
  status        text  not null default 'pending'
                       -- pending | paid | preparing | delivered | canceled
  payment_method text                        -- pix | card | boleto
  total         numeric(10,2) not null
  created_at    timestamptz default now()
  updated_at    timestamptz default now()

order_items
  id            uuid  PK  default gen_random_uuid()
  order_id      uuid  FK -> orders(id) on delete cascade not null
  product_id    text  FK -> products(id) not null
  name          text  not null               -- snapshot do nome no momento da compra
  unit_price    numeric(10,2) not null       -- snapshot do preço
  quantity      int   not null check (quantity > 0)
```

**Regra de vínculo (upsert de cliente):** no checkout, fazer *upsert* em `customers`
pelo `cpf`. Se já existir, reutiliza o `customer_id`; o pedido novo entra ligado ao
mesmo cliente → histórico automático.

Índices úteis: `orders(customer_id)`, `orders(created_at)`, `orders(status)`,
`order_items(order_id)`, `order_items(product_id)`.

---

## 5. Plano de ação por fases

### Fase 0 — Fundação Supabase
- [x] Adicionar `@supabase/supabase-js`; cliente em [src/lib/supabase.ts](src/lib/supabase.ts)
      + tipagem de env em [src/env.d.ts](src/env.d.ts) + `.env.example` + `.gitignore`.
- [x] Tabelas da seção 4 via migration: [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql).
- [x] RLS habilitado em todas as tabelas (na migration; políticas amplas na Fase 4).
- [x] *Seed* dos 4 sucos: [supabase/seed.sql](supabase/seed.sql).
- [x] **(Você)** Criar projeto Supabase (cloud), preencher `.env` e rodar a
      migration + o seed no SQL Editor — ver [supabase/README.md](supabase/README.md).
- [ ] **(Você)** Subir as imagens dos sucos ao Supabase Storage e preencher `image_url`.
      (Ainda pendente — hoje o front usa as imagens locais como fallback.)

### Fase 1 — Catálogo a partir do banco ✅
- [x] Criar `src/lib/api/products.ts` com query de produtos ativos.
- [x] Trocar o `products` estático por um hook TanStack Query (`useProducts`) em
      [src/routes/index.tsx](src/routes/index.tsx) e onde `getProductById` é usado.
- [x] Manter `formatBRL` em [src/lib/products.ts](src/lib/products.ts) (utilitário puro).

### Fase 2 — Checkout persistente + vínculo do cliente ✅
- [x] Criar uma **função Postgres `create_order` (RPC, `SECURITY DEFINER`)** que
      executa tudo numa **transação atômica** (supabase-js com chamadas separadas
      **não** é transacional — se um insert falhar, sobra pedido sem itens):
      1. upsert do cliente por `cpf` (atualiza nome/e-mail/telefone para o mais recente);
      2. cria o `order` (status `pending`) ligado ao `customer_id`;
      3. insere os `order_items`.
- [x] 🔒 **Preço vem do banco, nunca do cliente:** a RPC recebe apenas
      `{ product_id, quantity }` por item, lê `price`/`name` da tabela `products`
      (apenas `active = true`) e calcula `unit_price` e `total` no servidor. Nunca
      confiar em preço/total enviados pelo navegador (senão dá para forjar pedido
      de R$ 0,01 pelo devtools).
- [x] Gerar o `code` **no banco** com `unique` + retry em colisão (não no cliente).
- [x] Expor a RPC por uma server function; em [src/routes/checkout.tsx](src/routes/checkout.tsx)
      substituir o `setTimeout` simulado pela chamada real.
- [x] Ajustar [src/routes/obrigado.tsx](src/routes/obrigado.tsx) para ler o pedido
      retornado pela API (manter o ticket/comprovante atual).
- [x] Validar tudo com Zod **no servidor** (não confiar só no cliente).

### Fase 3 — Histórico do cliente ("pedidos vinculados")
> **Decisão atual (do dono):** começar **só com CPF** para liberar a consulta —
> implementação mais rápida. ⚠️ Isso é **provisório e fraco** (CPF é adivinhável →
> qualquer um veria o histórico de outra pessoa); não pode ir assim para produção
> com dados reais. **Migrar para magic link / OTP de e-mail (Supabase Auth) antes
> de produção** — ver tarefa abaixo, que fica planejada para depois.
- [x] (Provisório) Consulta por **CPF** em `/meus-pedidos`. Tratar como MVP de dev;
      não divulgar publicamente enquanto não tiver a verificação de e-mail.
- [ ] 🔒 **(Depois — antes de produção) Verificação por OTP/magic link de e-mail**
      (Supabase Auth — login por e-mail sem senha). Buscar pedidos só por CPF/e-mail
      vazaria dados pessoais (CPF é conhecido/adivinhável → qualquer um veria o
      histórico de outra pessoa). O cliente prova posse do e-mail antes de ver os
      pedidos ligados àquele cadastro.
- [x] Nova rota `/meus-pedidos`: lista o histórico e reabre comprovantes.
      Link a partir da página `/obrigado` e do `Header`.
- [x] (Opcional) Botão "Pedir de novo" que recria o carrinho a partir de um
      pedido anterior — recompra rápida.

### Fase 4 — Autenticação e segurança do admin ✅
> Migration: [supabase/migrations/0003_admin_rls.sql](supabase/migrations/0003_admin_rls.sql).
> Auth client-side (supabase-js) em [src/lib/auth.ts](src/lib/auth.ts); rotas em
> `src/routes/admin/`. **(Você)** precisa rodar a 0003 + criar o usuário admin no
> Supabase (Authentication → Users) e inseri-lo em `admin_users` — ver README.
- [x] Usar **Supabase Auth** (e-mail/senha) para os administradores.
- [x] Tabela `admin_users` (ou claim/role) marcando quem é admin. + helper `is_admin()`.
- [x] **Políticas RLS:**
      - `customers`, `orders`, `order_items`: leitura/escrita total só para admins;
        `INSERT` de pedido feito via server function com `service_role` (nunca expor
        a chave `service_role` no cliente).
      - `products`: leitura pública (apenas `active = true`); escrita só admin.
- [x] Guard de rota: `/admin/*` redireciona para login se não autenticado/sem role.

### Fase 5 — Painel administrativo (`/admin`) ✅
Rotas filhas sob `src/routes/admin/`:
- [x] **Dashboard** (`/admin`): cards de faturamento (hoje/semana/mês), nº de
      pedidos, ticket médio, e gráfico de vendas (**recharts**). **Realtime**
      assina `orders` (migration `0005_realtime_orders.sql`) e atualiza ao vivo.
- [x] **Pedidos** (`/admin/pedidos`): tabela com busca/filtro por status e
      cliente; detalhe do pedido; **mudar status** (pending → paid → preparing →
      delivered / canceled).
- [x] **Clientes** (`/admin/clientes`): lista de clientes com total gasto e nº de
      pedidos; detalhe abre o histórico vinculado (a feature "pedidos vinculados").
- [x] **Produtos** (`/admin/produtos`): CRUD de produtos (preço, tamanho/categoria,
      ativo, tag, cor, imagem). Id gerado automático de nome+tamanho.
- [x] **Categorias** (`/admin/categorias`): CRUD dos tamanhos (nome, ordem, ativa).
      (Adicionado a pedido do dono — categoria = tamanho.)
- [x] Layout admin com sidebar + `ui/table` em `src/components/ui/`.

### Fase 6 — Relatórios ✅
> **Unificado no Dashboard** (`/admin`) a pedido do dono — a rota `/admin/relatorios`
> foi removida. Métricas + gráficos (área de faturamento no tempo, pizza de vendas
> por tamanho, barras de vendas por sabor, barras por status) + filtro de período +
> export CSV, tudo na home do admin. Notificação realtime (som + popup) de pedido
> pago no layout `admin/route.tsx`.
- [x] Faturamento por período (filtro de datas + presets) e por status.
- [x] **Produtos mais vendidos** (agregação em `order_items`).
- [x] **Ticket médio** e nº de pedidos / clientes únicos no período.
- [x] Exportação **CSV** dos pedidos filtrados ([src/lib/csv.ts](src/lib/csv.ts)).
- [ ] (Opcional) Views/RPC no Postgres para pré-agregar métricas pesadas
      (só se o volume crescer — hoje a agregação no cliente dá conta).

### Fase 7 — Pagamento (Mercado Pago) *(após o núcleo)* ✅ (código)
> Checkout Transparente via **Payment Brick** (cartão + Pix). SDKs
> `@mercadopago/sdk-react` (cliente) e `mercadopago` (servidor).
- [x] Integrar Mercado Pago (Checkout Transparente / Bricks):
      [src/components/PaymentBrick.tsx](src/components/PaymentBrick.tsx),
      server fn [src/lib/api/payments.ts](src/lib/api/payments.ts) (`processCheckout`:
      cria pedido via RPC, cobra no MP com o total do servidor, atualiza status),
      cliente MP em [src/lib/mercadopago.server.ts](src/lib/mercadopago.server.ts).
      Checkout em 3 passos (dados → pagamento → Pix/obrigado).
- [x] **Webhook** [src/routes/api/webhooks/mercadopago.ts](src/routes/api/webhooks/mercadopago.ts)
      valida HMAC-SHA256 e atualiza `orders.status` (paid/canceled). **(Você)**
      configurar a URL no painel do MP + `MERCADOPAGO_WEBHOOK_SECRET` no `.env`.
- [x] Status real reflete no admin e no histórico (já leem `orders.status`).
- [ ] **(Você)** Testar ponta a ponta: cartão (local) e Pix (via túnel/deploy p/ webhook).

---

## 6. Estrutura de arquivos proposta (novos)

```
src/
  lib/
    supabase.ts            # cliente Supabase (browser)
    supabase.server.ts     # cliente service_role (apenas server)
    api/
      products.ts          # queries/mutations de produtos
      orders.ts            # createOrder, listOrders, updateStatus
      customers.ts         # histórico por cliente
      reports.ts           # agregações de relatórios
  routes/
    meus-pedidos.tsx       # histórico público do cliente (por CPF/e-mail)
    admin/
      route.tsx            # layout + guard de auth
      index.tsx            # dashboard
      pedidos.tsx
      clientes.tsx
      produtos.tsx
      login.tsx

Dockerfile               # build multi-stage (ver Seção 7)
docker-compose.yml       # stack do Portainer
.dockerignore            # node_modules, .git, .output, .env
```

---

## 7. Deployment — Docker + Portainer

A aplicação é **SSR (TanStack Start + Nitro)**, então em produção roda como um
**servidor Node dentro de um container**, e não como site estático. O deploy é
feito via **stack no Portainer**.

### ⚠️ Pré-requisito: trocar o target do Nitro (bloqueador de Docker)

A config de build atual (pacote `@lovable.dev/vite-tanstack-config`, usado só como
scaffolding do front) compila o Nitro mirando **Cloudflare Workers** por padrão
(ver comentário no [vite.config.ts](vite.config.ts): *"nitro (build-only using
cloudflare as a default target)"*). Esse artefato **não** gera um servidor Node
executável em container. Para rodar em Docker é obrigatório forçar o preset Nitro
para **`node-server`** (ou `bun`):

```ts
// vite.config.ts
export default defineConfig({
  tanstackStart: { server: { entry: "server" } },
  // sobrescreve o target padrão (cloudflare) para gerar um servidor Node
  nitro: { preset: "node-server" },
});
```

> Validar o nome exato do preset/saída rodando `bun run build` uma vez e conferindo
> a pasta `.output/`. Sem essa troca, o container não sobe.

### Supabase: cloud vs. self-hosted

Como tudo será orquestrado em Docker, há duas opções para o Supabase:

| Opção | Quando usar |
|---|---|
| **Supabase Cloud** (recomendado p/ começar) | Menos infra para manter; o container do app só precisa das envs `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Backups e Auth gerenciados. |
| **Supabase self-hosted** (mesmo Docker) | Quando exigir dados 100% on-premise. Adiciona ~8 serviços ao compose (db, auth, rest, storage, kong, studio...). Mais controle, bem mais manutenção. |

> Sugestão: subir o **app** no Docker/Portainer agora e usar **Supabase Cloud**;
> migrar para self-hosted depois só se houver requisito de dados locais.

### Dockerfile (multi-stage, Bun)

```dockerfile
# build
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
# envs VITE_* precisam existir no build (são embutidas no bundle do cliente)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
RUN bun run build

# runtime
FROM oven/bun:1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["bun", "./.output/server/index.mjs"]
```

> Confirmar o caminho do entrypoint gerado pelo Nitro (`.output/server/index.mjs`)
> rodando `bun run build` localmente uma vez. Ajustar `CMD`/porta conforme a saída.

### Stack do Portainer (docker-compose)

```yaml
services:
  nectar-pura:
    build:
      context: .
      args:
        VITE_SUPABASE_URL: ${VITE_SUPABASE_URL}
        VITE_SUPABASE_ANON_KEY: ${VITE_SUPABASE_ANON_KEY}
    image: nectar-pura:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      # segredos SÓ de servidor (nunca prefixados com VITE_)
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
      MERCADOPAGO_ACCESS_TOKEN: ${MERCADOPAGO_ACCESS_TOKEN}
```

### Cuidados específicos de Docker

- **Variáveis `VITE_*` são embutidas no build** (cliente) → precisam estar
  presentes como `ARG` no momento do `bun run build`, não só em runtime.
- **Segredos de servidor** (`service_role`, token Mercado Pago) entram só como
  `environment` em runtime, **sem** prefixo `VITE_` — assim nunca vão para o bundle.
- No Portainer, gerenciar esses valores em **Stack → Environment variables**
  (ou Docker secrets), não commitados no repositório.
- Pôr a stack atrás de um **reverse proxy com HTTPS** (Traefik/Nginx Proxy
  Manager) — obrigatório para Mercado Pago e cookies de sessão do admin.
- O **webhook do Mercado Pago** (Fase 7) precisa de URL pública HTTPS apontando
  para o container.
- **Fluxo:** desenvolvimento local com `bun run dev` + Supabase (cloud);
  **produção** roda o container no Docker/Portainer a partir do build.

---

## 8. Convenções e cuidados

- **Segredos:** `service_role` do Supabase **nunca** no bundle do cliente — só em
  server functions. No cliente, apenas a `anon key` + RLS.
- **Snapshots:** `order_items` guarda nome e preço do momento da compra, para o
  histórico não mudar quando o preço do produto for alterado.
- **Money:** usar `numeric(10,2)` no banco; manter `formatBRL` para exibição.
- **Preço/total sempre no servidor:** calculados a partir da tabela `products`,
  nunca a partir do que o cliente envia.
- **Validação dupla:** Zod no cliente (UX) **e** no servidor (segurança).
- **LGPD:** dados pessoais (CPF/e-mail/telefone) só acessíveis por admin (RLS);
  consentimento no checkout; sem exposição em endpoint público.
- **Comandos:** `bun run dev` (dev), `bun run lint`, `bun run build`.

---

## 9. Próximo passo imediato

Começar pela **Fase 0** (conectar Supabase + criar tabelas + seed de produtos),
pois ela desbloqueia todo o resto. Sem persistência de pedidos, o painel admin não
tem dados para exibir.
