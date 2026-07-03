import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Checa no banco (RPC is_admin) se o usuário logado é admin.
export async function checkIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) {
    console.error("is_admin error:", error);
    return false;
  }
  return data === true;
}

// Login de admin: autentica e exige que seja admin (senão desloga e falha).
export async function signInAdmin(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const isAdmin = await checkIsAdmin();
  if (!isAdmin) {
    await supabase.auth.signOut();
    throw new Error("not_admin");
  }
}

export async function signOutAdmin() {
  await supabase.auth.signOut();
}

export interface AdminSessionState {
  loading: boolean;
  isAdmin: boolean;
  email: string | null;
}

// Hook que acompanha a sessão + papel de admin, reagindo a login/logout.
export function useAdminSession(): AdminSessionState {
  const [state, setState] = useState<AdminSessionState>({
    loading: true,
    isAdmin: false,
    email: null,
  });

  useEffect(() => {
    let active = true;

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (active) setState({ loading: false, isAdmin: false, email: null });
        return;
      }

      const isAdmin = await checkIsAdmin();
      if (active) {
        setState({ loading: false, isAdmin, email: session.user.email ?? null });
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
