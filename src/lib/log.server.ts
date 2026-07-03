// Registro de erros de servidor em public.error_log (via service_role, bypassa
// RLS). SÓ servidor — importar dinamicamente dentro de handlers. Nunca lança:
// falha de log não pode derrubar o fluxo que a chamou.

export async function logServerError(
  source: string,
  error: unknown,
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase.server");
    const message = error instanceof Error ? error.message : String(error);
    await supabaseAdmin.from("error_log").insert({
      source,
      message: message.slice(0, 1000),
      detail: detail ? (JSON.parse(JSON.stringify(detail)) as Record<string, unknown>) : null,
    });
  } catch (e) {
    // Sem tabela/coluna ou instabilidade: cai só no console, não propaga.
    console.error("logServerError falhou:", e);
  }
}
