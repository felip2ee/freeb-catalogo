# FreeB — Checklist de Produção + Roadmap de Features

> Documento de acompanhamento para levar o app a produção (domínio **freebsucos.com**)
> e para as próximas features solicitadas pelo dono. Marque os `[ ]` conforme concluir.

---

## 🚀 Checklist para produção (independente das features)

### 🔒 Segurança / LGPD — *bloqueadores*
- [ ] **Migrar `/meus-pedidos` de CPF-only para OTP / magic-link de e-mail** (Fase 3 pendente).
      Hoje qualquer um digita um CPF e vê o histórico de outra pessoa — não pode ir a
      produção assim com dados reais.
- [ ] **Exigir `MERCADOPAGO_WEBHOOK_SECRET` em produção.** Hoje, sem o secret, o webhook
      pula a validação de assinatura (`src/routes/api/webhooks/mercadopago.ts:47-51`) e
      aceita notificação forjada. Em produção deve falhar se o secret faltar.
- [ ] **Consentimento LGPD no checkout** (checkbox + registro) e política de retenção dos
      dados pessoais (CPF / e-mail / telefone).
- [ ] Revisar RLS: confirmar que `service_role` só é usada no servidor e nunca vaza no bundle.

### 🐳 Infra / Deploy
- [ ] **Trocar preset do Nitro para `node-server`** no `vite.config.ts` (hoje mira Cloudflare —
      o container não sobe sem isso).
- [ ] `Dockerfile` + `docker-compose.yml` + `.dockerignore` (rascunhos no CLAUDE.md §7).
- [ ] `bun run build` local para confirmar o entrypoint (`.output/server/index.mjs`).
- [ ] **Reverse proxy com HTTPS** (Traefik / Nginx Proxy Manager) — obrigatório p/ MP e
      cookies de admin.
- [ ] **DNS de `freebsucos.com`** → servidor + certificado SSL.
- [ ] Envs no Portainer: `VITE_*` como `ARG` no build; segredos (`SERVICE_ROLE`,
      `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`) só em runtime, **sem** prefixo `VITE_`.

### 💳 Pagamento (Mercado Pago)
- [ ] Access Token de **produção** (`APP_USR-...`) em `MERCADOPAGO_ACCESS_TOKEN`.
- [x] Webhook cadastrado no painel do MP + assinatura secreta gerada.
- [ ] Preencher `MERCADOPAGO_WEBHOOK_SECRET` no `.env` local e no Portainer.
- [ ] Teste ponta a ponta: cartão + Pix, conferindo status virando `paid` no admin.

### 🗄️ Dados / Operação
- [ ] Subir imagens dos sucos ao Supabase Storage e preencher `image_url`
      (hoje usa fallback local).
- [ ] Backups do Supabase habilitados.
- [ ] Monitoramento de erros (conecta com a Feature 1).

---

## 🧩 Roadmap das features

### Feature 5 — 3 produtos por linha na loja (estilo iFood) ✅
- [x] Grid da loja em 3 colunas (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) + skeleton novo.
- [x] `ProductCard` repaginado no estilo iFood: card horizontal, foto quadrada à direita,
      botão "+" flutuante que vira stepper (− / qtd / +) ligado ao estado do carrinho.

### Feature 3 — Filtro de data personalizado no dashboard ✅
- [x] Preset **"Personalizado"** com dois seletores de data (início/fim) que alimentam o
      `from`/`to` já existente. CSV e todos os gráficos respeitam o intervalo escolhido.

### Feature 4 — Tamanho do suco no pedido 🟡 *médio (mexe no banco)*
- [ ] Migration `0006`: `alter table order_items add column size text`.
- [ ] Ajustar a RPC `create_order` (`supabase/migrations/0002_create_order.sql`) para ler
      `products.volume` (ou a categoria) e gravar no snapshot.
- [ ] Exibir o tamanho em: admin/pedidos, diálogo de entrega, comprovante (`obrigado`) e
      `meus-pedidos`.
- [ ] Backfill dos pedidos antigos com o volume atual do produto (melhor esforço).

### Feature 2 — Funcionários (entregador) 🟠 *grande (roles + RLS)*
- [ ] Migration: adicionar `role` em `admin_users` (`admin` | `staff`) + helper `is_staff()`;
      ajustar `is_admin()`.
- [ ] **RLS:** staff pode `SELECT` pedidos/clientes, mas `UPDATE` só de `paid` → `delivered`
      (via `WITH CHECK (status='delivered')`) — nada de faturamento, produtos ou outros status.
- [ ] **UI por papel:** esconder Dashboard / Produtos / Categorias / CSV; mostrar só uma tela
      "Do dia" (vendas, pedidos e clientes do dia). Guard no `route.tsx` por papel.
- [ ] Tela de gestão de funcionários (criar / desativar) — depende da Feature 1.

### Feature 1 — Configurações + credenciais + auditoria + logs 🔴 *a maior*
- [ ] **Configurações do app** (nome da loja, WhatsApp, etc.): tabela `settings` (key/value),
      CRUD só admin.
- [ ] **Credenciais (MP etc.):** ✅ **Decidido — ficam no `.env`** (não no banco, não editáveis
      pelo painel). O painel só exibe um **indicador de status "configurado / faltando"**, sem
      nunca enviar o valor do segredo ao navegador.
- [ ] **Log de auditoria** (quem mudou status, editou produto, criou funcionário): tabela
      `audit_log` + registro nas ações de escrita.
- [ ] **Log de erros / geral:** capturar erros de servidor (webhook, RPC) em `error_log`
      + tela para visualizar.

---

## Ordem recomendada
1. Feature 5 + Feature 3 (rápidas, ganho visível).
2. Feature 4 (tamanho no pedido) — antes de rodar vendas reais.
3. Feature 2 (funcionários) — antes de operar com equipe.
4. Feature 1 (config / auditoria / logs) — a mais pesada, feita por partes.
5. Bloqueadores de produção (OTP de e-mail + webhook secret obrigatório) antes de abrir ao público.
