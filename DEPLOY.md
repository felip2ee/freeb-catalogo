# Deploy — FreeB (Néctar Pura) via Docker + Portainer

App **SSR** (TanStack Start + Nitro `node-server`) que roda como um servidor Node
em container. Conecta ao **Supabase Cloud** (não sobe banco na stack). Deploy pela
UI do Portainer apontando para este repositório no GitHub.

## Pré-requisitos (uma vez)
- Repo publicado no GitHub (público, ou privado + credencial no Portainer).
- Projeto **Supabase Cloud** já criado, com migrations + seed + admin aplicados
  (já está — ver `supabase/README.md`).
- Reverse proxy com **HTTPS** na frente (Traefik / Nginx Proxy Manager).
  Obrigatório para cookies de sessão do admin e para o webhook do Mercado Pago.

## Passo a passo (Portainer)
1. **Stacks → Add stack → Repository.**
2. **Repository URL:** URL do repo no GitHub. **Reference:** `refs/heads/main`.
3. **Compose path:** `docker-compose.yml`.
4. **Environment variables** → adicione (valores reais do seu `.env` local):

   | Variável | Tipo | Observação |
   |---|---|---|
   | `VITE_SUPABASE_URL` | build+runtime | pública (embutida no bundle) |
   | `VITE_SUPABASE_ANON_KEY` | build+runtime | pública (RLS protege) |
   | `VITE_MERCADOPAGO_PUBLIC_KEY` | build+runtime | Payment Brick (cliente) |
   | `SUPABASE_SERVICE_ROLE_KEY` | **segredo** | só servidor |
   | `MERCADOPAGO_ACCESS_TOKEN` | **segredo** | só servidor |
   | `MERCADOPAGO_WEBHOOK_SECRET` | **segredo** | só servidor |
   | `APP_URL` | runtime | URL pública HTTPS, sem barra no fim |
   | `APP_PORT` | runtime | opcional (padrão 3000) |

5. **Deploy the stack.** O Portainer clona o repo, roda o `Dockerfile`
   (multi-stage Bun) e sobe o container `freeb` na porta `APP_PORT`.

> ⚠️ As `VITE_*` são **embutidas no build**. Se você trocar uma delas, precisa
> **rebuildar a imagem** (Portainer → Stack → *Pull and redeploy* / *Re-pull image*),
> não basta reiniciar o container.

## Atualizar (novo deploy)
Push no GitHub → Portainer → Stack → **Pull and redeploy** (rebuilda a imagem a
partir do commit novo).

## Mercado Pago — webhook (pós-deploy)
Com a URL HTTPS pública no ar:
1. Painel do MP → **Webhooks** → aponte para `https://SEU-DOMINIO/api/webhooks/mercadopago`.
2. Copie a **Assinatura secreta** → `MERCADOPAGO_WEBHOOK_SECRET` na stack → redeploy.
3. Teste Pix ponta a ponta (o webhook confirma o pagamento e atualiza o status).

## Build/local (sanidade antes de subir)
```bash
bun run build                     # gera .output/ (preset node-server)
PORT=3000 bun ./.output/server/index.mjs   # sobe o servidor SSR local
```

## Notas
- Preset do Nitro forçado para `node-server` em `vite.config.ts`
  (o padrão do scaffolding mirava Cloudflare e não roda em container).
- `.env` está no `.gitignore` — segredos **nunca** vão para o repo; ficam só na
  stack do Portainer.
- Healthcheck do container: `GET /` na porta interna 3000.
