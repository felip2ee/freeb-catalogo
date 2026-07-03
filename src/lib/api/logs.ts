import { supabase } from "@/lib/supabase";

// Leitura dos logs para o painel admin (RLS: só admin lê).

export interface AuditEntry {
  id: string;
  actor_email: string | null;
  action: "INSERT" | "UPDATE" | "DELETE" | string;
  entity: string;
  entity_id: string | null;
  summary: string | null;
  created_at: string;
}

export async function listAuditLog(): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("id,actor_email,action,entity,entity_id,summary,created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as AuditEntry[];
}

export interface ErrorEntry {
  id: string;
  source: string;
  message: string;
  detail: Record<string, unknown> | null;
  created_at: string;
}

export async function listErrorLog(): Promise<ErrorEntry[]> {
  const { data, error } = await supabase
    .from("error_log")
    .select("id,source,message,detail,created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as ErrorEntry[];
}
