import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBRL } from "@/lib/products";
import { statusMeta } from "@/lib/order-status";
import { adminOrdersQuery, customerStatsFromOrders, type CustomerStats } from "@/lib/api/admin";

export const Route = createFileRoute("/admin/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Admin FreeB" }] }),
  component: AdminClientes,
});

function AdminClientes() {
  // Um único fetch: as estatísticas por cliente são derivadas da mesma lista
  // de pedidos usada pelas outras telas (antes eram dois full scans de orders).
  const orders = useQuery(adminOrdersQuery);
  const customers = useMemo(() => customerStatsFromOrders(orders.data ?? []), [orders.data]);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CustomerStats | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.cpf.includes(q.replace(/\D/g, "")),
    );
  }, [customers, search]);

  const selectedOrders = useMemo(() => {
    if (!selected) return [];
    return (orders.data ?? []).filter((o) => o.customer?.id === selected.id);
  }, [orders.data, selected]);

  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight">Clientes</h1>
      <p className="mt-1 text-sm text-brand-deep/60">
        {customers.length} cliente(s) — ordenados por total gasto.
      </p>

      <div className="relative mt-6 max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-deep/40" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, e-mail ou CPF"
          className="pl-9"
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-brand-deep/10 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead className="text-center">Pedidos</TableHead>
              <TableHead>Total gasto</TableHead>
              <TableHead>Último pedido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-brand-deep/60">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-brand-deep/60">
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id} onClick={() => setSelected(c)} className="cursor-pointer">
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-brand-deep/60">
                    <div>{c.email}</div>
                    <div className="text-xs">{c.phone}</div>
                  </TableCell>
                  <TableCell className="text-center">{c.orderCount}</TableCell>
                  <TableCell className="font-medium">{formatBRL(c.totalSpent)}</TableCell>
                  <TableCell className="text-brand-deep/60">
                    {c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Histórico do cliente */}
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="rounded-xl border border-brand-deep/10 p-4">
                <p className="text-brand-deep/60">{selected.email}</p>
                <p className="text-brand-deep/60">{selected.phone}</p>
                <p className="font-mono text-xs text-brand-deep/50">CPF {selected.cpf}</p>
                <div className="mt-3 flex gap-6 border-t border-brand-deep/10 pt-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-brand-deep/50">Pedidos</p>
                    <p className="font-display text-xl font-bold">{selected.orderCount}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-brand-deep/50">
                      Total gasto
                    </p>
                    <p className="font-display text-xl font-bold">
                      {formatBRL(selected.totalSpent)}
                    </p>
                  </div>
                </div>
              </div>

              <ul className="space-y-2">
                {selectedOrders.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between rounded-xl border border-brand-deep/10 p-3"
                  >
                    <div>
                      <p className="font-mono text-xs font-bold">{o.code}</p>
                      <p className="text-xs text-brand-deep/50">
                        {new Date(o.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${statusMeta(o.status).className}`}
                      >
                        {statusMeta(o.status).label}
                      </span>
                      <span className="font-medium">{formatBRL(o.total)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
