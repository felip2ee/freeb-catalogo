import { queryOptions, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase";

// Configurações da loja (tabela settings, key/value). Leitura pública (usadas no
// storefront); escrita só admin via RLS. Credenciais NÃO ficam aqui — ver
// getCredentialStatus (server function que só reporta configurado/faltando).

export type StoreSettings = {
  store_name: string;
  store_description: string;
  whatsapp: string;
  instagram: string;
  contact_email: string;
  pickup_address: string;
};

// Defaults usados enquanto o banco não tem valores (migration não rodada, campo
// vazio). O storefront sempre renderiza algo coerente.
export const DEFAULT_SETTINGS: StoreSettings = {
  store_name: "FreeB",
  store_description:
    "Sucos 100% naturais, do produtor à sua mesa. Trabalhamos com produtores locais e embalagens recicláveis.",
  whatsapp: "",
  instagram: "",
  contact_email: "",
  pickup_address: "",
};

export async function fetchSettings(): Promise<StoreSettings> {
  const { data, error } = await supabase.from("settings").select("key,value");
  if (error) throw error;

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.value != null && row.value !== "") map[row.key] = row.value as string;
  }
  return { ...DEFAULT_SETTINGS, ...map };
}

export const settingsQueryOptions = queryOptions({
  queryKey: ["settings"],
  queryFn: fetchSettings,
  staleTime: 5 * 60 * 1000, // muda pouco
});

export function useSettings() {
  const query = useQuery(settingsQueryOptions);
  return { ...query, settings: query.data ?? DEFAULT_SETTINGS };
}

// Salva um subconjunto das settings (upsert por key). Admin only (RLS).
export async function saveSettings(values: Partial<StoreSettings>): Promise<void> {
  const now = new Date().toISOString();
  const rows = Object.entries(values).map(([key, value]) => ({
    key,
    value: value ?? "",
    updated_at: now,
  }));
  if (rows.length === 0) return;
  const { error } = await supabase.from("settings").upsert(rows);
  if (error) throw error;
}

// ── Status das credenciais (nunca expõe o valor) ─────────────────────────────
export interface CredentialStatus {
  key: string;
  label: string;
  scope: "servidor" | "build (cliente)";
  configured: boolean;
  note?: string;
}

export const getCredentialStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<CredentialStatus[]> => {
    // VITE_* podem chegar por process.env (runtime) ou terem sido embutidas no
    // build; checamos ambos. Segredos de servidor só por process.env.
    const env = (k: string): string | undefined =>
      process.env[k] ?? (import.meta.env as Record<string, string | undefined>)?.[k];

    const has = (k: string) => Boolean(env(k) && env(k)!.length > 0);

    const mpToken = env("MERCADOPAGO_ACCESS_TOKEN") ?? "";
    const mpMode = !mpToken
      ? undefined
      : mpToken.startsWith("APP_USR-")
        ? "Token de produção"
        : mpToken.startsWith("TEST-")
          ? "Token de teste"
          : "Formato desconhecido";

    return [
      {
        key: "VITE_SUPABASE_URL",
        label: "Supabase URL",
        scope: "build (cliente)",
        configured: has("VITE_SUPABASE_URL"),
      },
      {
        key: "VITE_SUPABASE_ANON_KEY",
        label: "Supabase anon key",
        scope: "build (cliente)",
        configured: has("VITE_SUPABASE_ANON_KEY"),
      },
      {
        key: "SUPABASE_SERVICE_ROLE_KEY",
        label: "Supabase service role",
        scope: "servidor",
        configured: has("SUPABASE_SERVICE_ROLE_KEY"),
      },
      {
        key: "VITE_MERCADOPAGO_PUBLIC_KEY",
        label: "Mercado Pago public key",
        scope: "build (cliente)",
        configured: has("VITE_MERCADOPAGO_PUBLIC_KEY"),
      },
      {
        key: "MERCADOPAGO_ACCESS_TOKEN",
        label: "Mercado Pago access token",
        scope: "servidor",
        configured: has("MERCADOPAGO_ACCESS_TOKEN"),
        note: mpMode,
      },
      {
        key: "MERCADOPAGO_WEBHOOK_SECRET",
        label: "Mercado Pago webhook secret",
        scope: "servidor",
        configured: has("MERCADOPAGO_WEBHOOK_SECRET"),
      },
      {
        key: "APP_URL",
        label: "URL pública (APP_URL)",
        scope: "servidor",
        configured: has("APP_URL"),
        note: has("APP_URL") ? undefined : "Necessária para o webhook do Pix",
      },
    ];
  },
);
