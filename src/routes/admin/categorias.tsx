import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { slugify } from "@/lib/slug";
import {
  listAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type AdminCategory,
} from "@/lib/api/admin";

export const Route = createFileRoute("/admin/categorias")({
  head: () => ({ meta: [{ title: "Categorias — Admin FreeB" }] }),
  component: AdminCategorias,
});

interface FormState {
  name: string;
  sort_order: string;
  active: boolean;
}

const emptyForm: FormState = { name: "", sort_order: "0", active: true };

function AdminCategorias() {
  const qc = useQueryClient();
  const categories = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: listAdminCategories,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminCategory | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "categories"] });
    qc.invalidateQueries({ queryKey: ["categories"] }); // loja
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, sort_order: String((categories.data?.length ?? 0) * 10 + 10) });
    setDialogOpen(true);
  };

  const openEdit = (c: AdminCategory) => {
    setEditing(c);
    setForm({ name: c.name, sort_order: String(c.sort_order), active: c.active });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (form.name.trim().length < 1) return toast.error("Informe o nome do tamanho");
    const sort = parseInt(form.sort_order, 10);
    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.id, {
          name: form.name.trim(),
          sort_order: Number.isFinite(sort) ? sort : 0,
          active: form.active,
        });
        toast.success("Categoria atualizada");
      } else {
        const id = slugify(form.name);
        if (!id) return toast.error("Nome inválido");
        await createCategory({
          id,
          name: form.name.trim(),
          sort_order: Number.isFinite(sort) ? sort : 0,
          active: form.active,
        });
        toast.success("Categoria criada");
      }
      invalidate();
      setDialogOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error("Não foi possível salvar", {
        description: msg.includes("duplicate") ? "Já existe essa categoria." : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCategory(deleteTarget.id);
      toast.success("Categoria excluída");
      invalidate();
    } catch {
      toast.error("Não foi possível excluir", {
        description: "Há produtos usando essa categoria. Reatribua-os antes.",
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Categorias</h1>
          <p className="mt-1 text-sm text-brand-deep/60">Tamanhos disponíveis para os produtos.</p>
        </div>
        <Button
          onClick={openCreate}
          className="rounded-full bg-brand-deep text-brand-cream hover:bg-brand-deep/90"
        >
          <Plus className="size-4" />
          Nova categoria
        </Button>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-brand-deep/10 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>ID</TableHead>
              <TableHead className="text-center">Ordem</TableHead>
              <TableHead className="text-center">Ativa</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-brand-deep/60">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : (categories.data?.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-brand-deep/60">
                  Nenhuma categoria.
                </TableCell>
              </TableRow>
            ) : (
              categories.data!.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs text-brand-deep/50">{c.id}</TableCell>
                  <TableCell className="text-center">{c.sort_order}</TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.active
                          ? "bg-emerald-500/15 text-emerald-800"
                          : "bg-brand-deep/10 text-brand-deep/60"
                      }`}
                    >
                      {c.active ? "Sim" : "Não"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(c)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-widest text-brand-deep/70">
                Nome (ex.: 700ml, 2 litros)
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="700ml"
              />
              {!editing && form.name && (
                <p className="text-xs text-brand-deep/50">
                  ID gerado: <span className="font-mono">{slugify(form.name) || "—"}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-widest text-brand-deep/70">
                Ordem (menor aparece primeiro)
              </Label>
              <Input
                inputMode="numeric"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
              <span className="text-sm text-brand-deep/70">Ativa (aparece na loja)</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-brand-deep text-brand-cream hover:bg-brand-deep/90"
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" será removida. Se houver produtos usando esse tamanho,
              reatribua-os antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
