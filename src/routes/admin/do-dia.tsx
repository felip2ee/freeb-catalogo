import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Truck, PackageCheck, Check, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { adminOrdersQuery, updateOrderStatus, type AdminOrder } from "@/lib/api/admin";

export const Route = createFileRoute("/admin/do-dia")({
  head: () => ({ meta: [{ title: "Do dia — FreeB" }] }),
  component: DoDia,
});

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

function DoDia() {
  const qc = useQueryClient();
  const orders = useQuery(adminOrdersQuery);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [saving, setSaving] = useState(false);

  const all = useMemo(() => orders.data ?? [], [orders.data]);

  // A entregar = pedidos pagos (aguardando retirada/entrega), mais antigos primeiro.
  const toDeliver = useMemo(
    () =>
      all
        .filter((o) => o.status === "paid")
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [all],
  );
  const ordersToday = useMemo(() => all.filter((o) => isToday(o.created_at)).length, [all]);

  const finalize = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateOrderStatus(selected.id, "delivered");
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast.success(`Pedido ${selected.code} entregue ✅`);
      setSelected(null);
    } catch {
      toast.error("Não foi possível finalizar o pedido");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight">Do dia</h1>
      <p className="mt-1 text-sm text-brand-deep/60">
        Pedidos pagos aguardando entrega. Toque em um pedido para ver os itens e finalizar.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <StatCard icon={Truck} label="A entregar" value={toDeliver.length} />
        <StatCard icon={PackageCheck} label="Pedidos hoje" value={ordersToday} />
      </div>

      <div className="mt-6 rounded-2xl border border-brand-deep/10 bg-white p-5">
        <h2 className="font-display text-lg font-bold">Fila de entrega</h2>

        {orders.isLoading ? (
          <p className="mt-4 text-sm text-brand-deep/60">Carregando...</p>
        ) : toDeliver.length === 0 ? (
          <p className="mt-4 text-sm text-brand-deep/60">
            Nenhuma entrega pendente. Tudo em dia 🎉
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {toDeliver.map((o) => {
              const qty = o.items.reduce((s, i) => s + i.quantity, 0);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelected(o)}
                  className="rounded-xl border border-brand-deep/10 bg-brand-cream/40 p-4 text-left transition hover:border-accent-orange hover:bg-brand-cream"
                >
                  <span className="font-mono text-sm font-bold">{o.code}</span>
                  <p className="mt-1 truncate text-sm text-brand-deep/70">
                    {o.customer?.name ?? "—"}
                  </p>
                  <p className="mt-2 text-sm text-brand-deep/60">{qty} item(s)</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detalhe + confirmação de entrega (sem valores) */}
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono">{selected?.code}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="rounded-xl border border-brand-deep/10 p-3">
                <p className="font-semibold">{selected.customer?.name}</p>
                {selected.customer?.phone && (
                  <a
                    href={`tel:${selected.customer.phone.replace(/\D/g, "")}`}
                    className="mt-1 inline-flex items-center gap-1.5 text-brand-deep/70 hover:text-accent-orange"
                  >
                    <Phone className="size-3.5" />
                    {selected.customer.phone}
                  </a>
                )}
              </div>
              <ul className="divide-y divide-brand-deep/10">
                {selected.items.map((it) => (
                  <li key={it.product_id} className="py-2">
                    <span className="font-mono text-xs text-brand-deep/50">
                      {String(it.quantity).padStart(2, "0")}×
                    </span>{" "}
                    {it.name}
                    {it.size && <span className="text-xs text-brand-deep/50"> · {it.size}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancelar
            </Button>
            <Button
              onClick={finalize}
              disabled={saving}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Check className="size-4" />
              {saving ? "Finalizando..." : "Marcar como entregue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-brand-deep/10 bg-white p-5">
      <Icon className="size-6 text-accent-orange" />
      <p className="mt-3 text-xs uppercase tracking-widest text-brand-deep/50">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold">{value}</p>
    </div>
  );
}
