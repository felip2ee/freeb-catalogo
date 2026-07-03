import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
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
import { ACCENTS, formatBRL, type Accent } from "@/lib/products";
import { slugify } from "@/lib/slug";
import {
  listAdminProducts,
  listAdminCategories,
  createProduct,
  updateProduct,
  setProductActive,
  deleteProduct,
  type AdminProduct,
  type AdminCategory,
} from "@/lib/api/admin";

export const Route = createFileRoute("/admin/produtos")({
  head: () => ({ meta: [{ title: "Produtos — Admin FreeB" }] }),
  component: AdminProdutos,
});

interface FormState {
  name: string;
  description: string;
  price: string;
  category_id: string;
  accent: Accent;
  tag: string;
  image_url: string;
  active: boolean;
}

const emptyForm: FormState = {
  name: "",
  description: "",
  price: "",
  category_id: "",
  accent: "orange",
  tag: "",
  image_url: "",
  active: true,
};

function AdminProdutos() {
  const qc = useQueryClient();
  const products = useQuery({ queryKey: ["admin", "products"], queryFn: listAdminProducts });
  const categories = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: listAdminCategories,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null);

  const catById = (id: string | null) => categories.data?.find((c) => c.id === id)?.name ?? "—";

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: AdminProduct) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      price: String(p.price),
      category_id: p.category_id ?? "",
      accent: p.accent ?? "orange",
      tag: p.tag ?? "",
      image_url: p.image_url ?? "",
      active: p.active,
    });
    setDialogOpen(true);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "products"] });
    qc.invalidateQueries({ queryKey: ["products"] }); // loja
  };

  const handleSave = async () => {
    const price = Number(form.price.replace(",", "."));
    if (form.name.trim().length < 2) return toast.error("Informe o nome do produto");
    if (!form.category_id) return toast.error("Selecione o tamanho (categoria)");
    if (!Number.isFinite(price) || price < 0) return toast.error("Preço inválido");

    const categoryName = categories.data?.find((c) => c.id === form.category_id)?.name ?? "";

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        price,
        category_id: form.category_id,
        accent: form.accent,
        tag: form.tag.trim() || null,
        image_url: form.image_url.trim() || null,
        volume: categoryName,
        active: form.active,
      };

      if (editing) {
        await updateProduct(editing.id, payload);
        toast.success("Produto atualizado");
      } else {
        const id = `${slugify(form.name)}-${form.category_id}`;
        await createProduct({ id, ...payload });
        toast.success("Produto criado");
      }
      invalidate();
      setDialogOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error("Não foi possível salvar", {
        description: msg.includes("duplicate")
          ? "Já existe um produto com esse nome e tamanho."
          : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (p: AdminProduct, active: boolean) => {
    try {
      await setProductActive(p.id, active);
      invalidate();
    } catch {
      toast.error("Não foi possível alterar o status");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProduct(deleteTarget.id);
      toast.success("Produto excluído");
      invalidate();
    } catch {
      toast.error("Não foi possível excluir", {
        description: "Produto com pedidos não pode ser excluído — desative-o.",
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="mt-1 text-sm text-brand-deep/60">
            {products.data?.length ?? 0} produto(s) no catálogo.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="rounded-full bg-brand-deep text-brand-cream hover:bg-brand-deep/90"
        >
          <Plus className="size-4" />
          Novo produto
        </Button>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-brand-deep/10 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Tamanho</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Tag</TableHead>
              <TableHead className="text-center">Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-brand-deep/60">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : (products.data?.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-brand-deep/60">
                  Nenhum produto ainda. Clique em "Novo produto".
                </TableCell>
              </TableRow>
            ) : (
              products.data!.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{catById(p.category_id)}</TableCell>
                  <TableCell>{formatBRL(p.price)}</TableCell>
                  <TableCell className="text-brand-deep/60">{p.tag ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={p.active} onCheckedChange={(v) => handleToggleActive(p, v)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(p)}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <Field label="Nome">
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Suco de Laranja"
              />
            </Field>

            <Field label="Descrição">
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Pura polpa"
                rows={2}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Tamanho (categoria)">
                <Select
                  value={form.category_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories.data ?? []).map((c: AdminCategory) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Preço (R$)">
                <Input
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="14.90"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Cor (destaque)">
                <Select
                  value={form.accent}
                  onValueChange={(v) => setForm((f) => ({ ...f, accent: v as Accent }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCENTS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Tag (opcional)">
                <Input
                  value={form.tag}
                  onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
                  placeholder="Best Seller"
                />
              </Field>
            </div>

            <Field label="URL da imagem (opcional)">
              <Input
                value={form.image_url}
                onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                placeholder="https://... (Supabase Storage)"
              />
            </Field>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
              <span className="text-sm text-brand-deep/70">Ativo (visível na loja)</span>
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
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" será removido. Produtos com pedidos não podem ser excluídos —
              nesse caso, desative-o.
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-widest text-brand-deep/70">
        {label}
      </Label>
      {children}
    </div>
  );
}
