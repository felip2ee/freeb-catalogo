import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase";
import { listStaff, createStaff, removeStaff, type StaffMember } from "@/lib/api/staff";

export const Route = createFileRoute("/admin/funcionarios")({
  head: () => ({ meta: [{ title: "Funcionários — Admin FreeB" }] }),
  component: AdminFuncionarios,
});

// Token da sessão do admin (exigido pelas server functions privilegiadas).
async function adminToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("no_session");
  return session.access_token;
}

function AdminFuncionarios() {
  const qc = useQueryClient();
  const staff = useQuery({ queryKey: ["admin", "staff"], queryFn: listStaff });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<StaffMember | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "staff"] });

  const openCreate = () => {
    setEmail("");
    setPassword("");
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      return toast.error("E-mail inválido");
    }
    if (password.length < 8) {
      return toast.error("A senha precisa de ao menos 8 caracteres");
    }
    setSaving(true);
    try {
      await createStaff({
        data: { accessToken: await adminToken(), email: email.trim(), password },
      });
      toast.success("Funcionário criado", {
        description: "Ele já pode entrar no painel com esse e-mail e senha.",
      });
      invalidate();
      setDialogOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error("Não foi possível criar", {
        description:
          msg === "email_in_use"
            ? "Já existe uma conta com esse e-mail."
            : "Tente novamente em instantes.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    try {
      await removeStaff({
        data: { accessToken: await adminToken(), userId: removeTarget.user_id },
      });
      toast.success("Acesso removido");
      invalidate();
    } catch {
      toast.error("Não foi possível remover o funcionário");
    } finally {
      setRemoveTarget(null);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Funcionários</h1>
          <p className="mt-1 text-sm text-brand-deep/60">
            Entregadores com acesso restrito à tela "Do dia" (só marcam pedidos como entregues).
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="rounded-full bg-brand-deep text-brand-cream hover:bg-brand-deep/90"
        >
          <Plus className="size-4" />
          Novo funcionário
        </Button>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-brand-deep/10 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-mail</TableHead>
              <TableHead>Desde</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-brand-deep/60">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : (staff.data?.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-brand-deep/60">
                  Nenhum funcionário cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              staff.data!.map((s) => (
                <TableRow key={s.user_id}>
                  <TableCell className="flex items-center gap-2 font-medium">
                    <UserCog className="size-4 text-brand-deep/40" />
                    {s.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-brand-deep/60">
                    {new Date(s.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRemoveTarget(s)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Criar funcionário */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo funcionário</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-widest text-brand-deep/70">
                E-mail
              </Label>
              <Input
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="entregador@freebsucos.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-widest text-brand-deep/70">
                Senha provisória (mín. 8 caracteres)
              </Label>
              <Input
                type="text"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Anote e passe ao funcionário"
              />
              <p className="text-xs text-brand-deep/50">
                O funcionário entra em <span className="font-mono">/admin/login</span> com esse
                e-mail e senha.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving}
              className="bg-brand-deep text-brand-cream hover:bg-brand-deep/90"
            >
              {saving ? "Criando..." : "Criar funcionário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remover acesso */}
      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover funcionário?</AlertDialogTitle>
            <AlertDialogDescription>
              "{removeTarget?.email}" perde o acesso ao painel imediatamente. A conta é excluída;
              para readmitir, crie de novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
