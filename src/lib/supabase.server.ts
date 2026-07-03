import { createClient } from "@supabase/supabase-js";

// Cliente Supabase com a SERVICE ROLE — bypassa RLS. NUNCA importar no cliente.
// Só deve ser usado dentro de server functions (createServerFn handler).
// A chave vem de SUPABASE_SERVICE_ROLE_KEY (sem prefixo VITE_, fora do bundle).
const url = process.env.VITE_SUPABASE_URL ?? import.meta.env?.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error(
    "Supabase server não configurado: defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.",
  );
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
