import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Papel do usuário no painel: admin (tudo) | staff (entregas) | null (sem acesso).
export type PanelRole = "admin" | "staff" | null;

// Lê o papel do usuário logado (RPC my_role — SECURITY DEFINER).
export async function fetchRole(): Promise<PanelRole> {
  const { data, error } = await supabase.rpc("my_role");
  if (error) {
    console.error("my_role error:", error);
    return null;
  }
  return data === "admin" || data === "staff" ? data : null;
}

// Login do painel: autentica e exige um papel (admin ou staff); senão desloga.
export async function signInPanel(email: string, password: string): Promise<PanelRole> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const role = await fetchRole();
  if (!role) {
    await supabase.auth.signOut();
    throw new Error("not_authorized");
  }
  return role;
}

export async function signOutAdmin() {
  await supabase.auth.signOut();
}

export interface AdminSessionState {
  loading: boolean;
  role: PanelRole;
  isAdmin: boolean;
  isStaff: boolean;
  email: string | null;
}

// Hook que acompanha sessão + papel, reagindo a login/logout.
export function useAdminSession(): AdminSessionState {
  const [state, setState] = useState<AdminSessionState>({
    loading: true,
    role: null,
    isAdmin: false,
    isStaff: false,
    email: null,
  });

  useEffect(() => {
    let active = true;

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (active)
          setState({ loading: false, role: null, isAdmin: false, isStaff: false, email: null });
        return;
      }

      const role = await fetchRole();
      if (active) {
        setState({
          loading: false,
          role,
          isAdmin: role === "admin",
          isStaff: role === "staff",
          email: session.user.email ?? null,
        });
      }
    }

    load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => load());

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
