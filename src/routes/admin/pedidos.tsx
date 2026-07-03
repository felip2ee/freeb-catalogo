import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Eye } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/products";
import { ORDER_STATUSES, statusMeta, type OrderStatus } from "@/lib/order-status";
import { adminOrdersQuery, updateOrderStatus, type AdminOrder } from "@/lib/api/admin";
import { OrderItemsList } from "@/components/OrderItemsList";

export const Route = createFileRoute("/admin/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos — Admin FreeB" }] }),
  component: AdminPedidos,
});

function AdminPedidos() {
  const qc = useQueryClient();
  const orders = useQuery(adminOrdersQuery);

  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<AdminOrder | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (orders.data ?? []).filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.code.toLowerCase().includes(q) || (o.customer?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [orders.data, statusFilter, search]);

  const changeStatus = async (o: AdminOrder, status: OrderStatus) => {
    try {
      await updateOrderStatus(o.id, status);
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast.success(`Pedido ${o.code} → ${statusMeta(status).label}`);
    } catch {
      toast.error("Não foi possível mudar o status");
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight">Pedidos</h1>
      <p className="mt-1 text-sm text-brand-deep/60">
        {orders.data?.length ?? 0} pedido(s) no total.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-deep/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código ou cliente"
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}
        >
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusMeta(s).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-brand-deep/10 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-center">Itens</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Detalhe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-brand-deep/60">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-brand-deep/60">
                  Nenhum pedido encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((o) => {
                const created = new Date(o.created_at);
                const itemCount = o.items.reduce((s, i) => s + i.quantity, 0);
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs font-bold">{o.code}</TableCell>
                    <TableCell>{o.customer?.name ?? "—"}</TableCell>
                    <TableCell className="text-brand-deep/60">
                      {created.toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-center">{itemCount}</TableCell>
                    <TableCell className="font-medium">{formatBRL(o.total)}</TableCell>
                    <TableCell>
                      <Select
                        value={o.status}
                        onValueChange={(v) => changeStatus(o, v as OrderStatus)}
                      >
                        <SelectTrigger className="h-8 w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ORDER_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {statusMeta(s).label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setDetail(o)}>
                        <Eye className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detalhe do pedido */}
      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono">{detail?.code}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${statusMeta(detail.status).className}`}
                >
                  {statusMeta(detail.status).label}
                </span>
                <span className="text-brand-deep/60">
                  {new Date(detail.created_at).toLocaleString("pt-BR")}
                </span>
              </div>

              <div className="rounded-xl border border-brand-deep/10 p-4">
                <p className="font-semibold">{detail.customer?.name}</p>
                <p className="text-brand-deep/60">{detail.customer?.email}</p>
                <p className="text-brand-deep/60">{detail.customer?.phone}</p>
                <p className="font-mono text-xs text-brand-deep/50">CPF {detail.customer?.cpf}</p>
              </div>

              <OrderItemsList items={detail.items} />

              <div className="flex items-center justify-between border-t border-brand-deep/10 pt-3">
                <span className="text-xs uppercase tracking-widest text-brand-deep/60">
                  Total {detail.payment_method ? `· ${detail.payment_method}` : ""}
                </span>
                <span className="font-display text-2xl font-bold">{formatBRL(detail.total)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
