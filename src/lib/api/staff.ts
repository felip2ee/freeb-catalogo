import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

// Gestão de funcionários (papel 'staff'). Criar/remover exige mexer no Supabase
// Auth (service_role) → server functions, autorizadas pelo access_token do admin.
// Listar é via cliente com a sessão do admin (RLS admin_users_admin_all).

export interface StaffMember {
  user_id: string;
  email: string | null;
  created_at: string;
}

export async function listStaff(): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id,email,created_at")
    .eq("role", "staff")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as StaffMember[];
}

// Valida no servidor que o access_token pertence a um ADMIN (não staff).
async function assertAdmin(accessToken: string) {
  const { supabaseAdmin } = await import("@/lib/supabase.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("not_authenticated");
  const { data: row } = await supabaseAdmin
    .from("admin_users")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (row?.role !== "admin") throw new Error("not_admin");
  return data.user;
}

const createInput = z.object({
  accessToken: z.string().min(20),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
});

export const createStaff = createServerFn({ method: "POST" })
  .validator((data: unknown) => createInput.parse(data))
  .handler(async ({ data }): Promise<{ user_id: string }> => {
    await assertAdmin(data.accessToken);
    const { supabaseAdmin } = await import("@/lib/supabase.server");

    const email = data.email.toLowerCase();
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true, // funcionário criado pelo admin já entra direto
    });
    if (error || !created.user) {
      console.error("createStaff auth error:", error);
      throw new Error(error?.message?.includes("already") ? "email_in_use" : "create_failed");
    }

    const { error: insErr } = await supabaseAdmin
      .from("admin_users")
      .insert({ user_id: created.user.id, email, role: "staff" });
    if (insErr) {
      // Desfaz o usuário de Auth se não conseguiu marcar como staff.
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      console.error("createStaff insert error:", insErr);
      throw new Error("create_failed");
    }

    return { user_id: created.user.id };
  });

const removeInput = z.object({
  accessToken: z.string().min(20),
  userId: z.string().uuid(),
});

export const removeStaff = createServerFn({ method: "POST" })
  .validator((data: unknown) => removeInput.parse(data))
  .handler(async ({ data }): Promise<void> => {
    const admin = await assertAdmin(data.accessToken);
    if (admin.id === data.userId) throw new Error("cannot_remove_self");

    const { supabaseAdmin } = await import("@/lib/supabase.server");

    // Só remove se for realmente um staff (nunca outro admin por esta via).
    const { data: row } = await supabaseAdmin
      .from("admin_users")
      .select("role")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (row?.role !== "staff") throw new Error("not_staff");

    // Apaga o usuário de Auth; admin_users cai por FK on delete cascade.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) {
      console.error("removeStaff error:", error);
      throw new Error("remove_failed");
    }
  });
