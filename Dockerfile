# syntax=docker/dockerfile:1

# ---------- build ----------
FROM oven/bun:1 AS build
WORKDIR /app

# Instala dependências primeiro (cache de camada)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Código
COPY . .

# As VITE_* são EMBUTIDAS no bundle do cliente em tempo de build → precisam
# existir como ARG aqui (não adianta só em runtime). São públicas (protegidas
# por RLS no Supabase). NUNCA passe segredos de servidor como VITE_.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_MERCADOPAGO_PUBLIC_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_MERCADOPAGO_PUBLIC_KEY=$VITE_MERCADOPAGO_PUBLIC_KEY

# Gera .output/ com o preset node-server (ver vite.config.ts)
RUN bun run build

# ---------- runtime ----------
FROM oven/bun:1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Apenas o artefato de saída do Nitro (servidor Node SSR)
COPY --from=build /app/.output ./.output

EXPOSE 3000
# Segredos de servidor (SUPABASE_SERVICE_ROLE_KEY, MERCADOPAGO_ACCESS_TOKEN,
# MERCADOPAGO_WEBHOOK_SECRET, APP_URL) entram só em runtime via environment.
CMD ["bun", "./.output/server/index.mjs"]
