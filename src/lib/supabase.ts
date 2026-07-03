import { createClient } from "@supabase/supabase-js";

// Cliente Supabase para o navegador (usa a anon key — protegido por RLS).
// Segredos de servidor (service_role) NUNCA entram aqui — ver supabase.server.ts (Fase 2).
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env (ver .env.example).",
  );
}

export const supabase = createClient(url, anonKey);
