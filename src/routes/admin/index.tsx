import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
} from "recharts";
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Users,
  Radio,
  Download,
  PackageCheck,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatBRL } from "@/lib/products";
import { statusMeta } from "@/lib/order-status";
import {
  adminOrdersQuery,
  listAdminProducts,
  listAdminCategories,
  updateOrderStatus,
  type AdminOrder,
} from "@/lib/api/admin";
import { OrderItemsList } from "@/components/OrderItemsList";
import { toCSV, downloadCSV } from "@/lib/csv";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Dashboard — Admin FreeB" }] }),
  component: AdminDashboard,
});

const PALETTE = ["#E8772E", "#E86A9A", "#D9A441", "#7C5CBF", "#2F5D50", "#8FB43A"];

const ymd = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
const brNumber = (n: number) => n.toFixed(2).replace(".", ",");
const isRevenue = (o: AdminOrder) => o.status !== "canceled";
const shortFlavor = (name: string) => name.replace(/^suco de\s+/i, "");

type Preset = "7d" | "30d" | "month" | "all" | "custom";

function AdminDashboard() {
  const orders = useQuery(adminOrdersQuery);
  const products = useQuery({ queryKey: ["admin", "products"], queryFn: listAdminProducts });
  const categories = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: listAdminCategories,
  });

  const [preset, setPreset] = useState<Preset>("30d");
  // Intervalo personalizado (yyyy-mm-dd, formato nativo do <input type="date">).
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { from, to } = useMemo(() => {
    const now = new Date();
    const today = ymd(now);
    if (preset === "custom") return { from: customFrom, to: customTo };
    if (preset === "all") return { from: "", to: "" };
    if (preset === "month") {
      return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    }
    const days = preset === "7d" ? 6 : 29;
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    return { from: ymd(start), to: today };
  }, [preset, customFrom, customTo]);

  const filtered = useMemo(() => {
    return (orders.data ?? []).filter((o) => {
      const d = o.created_at.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [orders.data, from, to]);

  const revenueOrders = useMemo(() => filtered.filter(isRevenue), [filtered]);

  const productCategory = useMemo(() => {
    const catName = new Map((categories.data ?? []).map((c) => [c.id, c.name]));
    const map = new Map<string, string>();
    for (const p of products.data ?? []) {
      map.set(p.id, p.category_id ? (catName.get(p.category_id) ?? "—") : "Sem tamanho");
    }
    return map;
  }, [products.data, categories.data]);

  const metrics = useMemo(() => {
    const revenue = revenueOrders.reduce((s, o) => s + o.total, 0);
    const count = revenueOrders.length;
    const customers = new Set(revenueOrders.map((o) => o.customer?.id).filter(Boolean)).size;
    return { revenue, count, avg: count > 0 ? revenue / count : 0, customers };
  }, [revenueOrders]);

  // Constrói o esqueleto da série diária [from..to] com buckets zerados.
  const buildDaily = useMemo(() => {
    return () => {
      const base = orders.data ?? [];
      const start = from
        ? new Date(from + "T00:00:00")
        : base.length
          ? new Date(Math.min(...base.map((o) => new Date(o.created_at).getTime())))
          : new Date();
      const end = to ? new Date(to + "T00:00:00") : new Date();
      const days: { label: string; key: string; value: number }[] = [];
      const cur = new Date(start);
      cur.setHours(0, 0, 0, 0);
      let guard = 0;
      while (cur <= end && guard < 400) {
        days.push({
          label: cur.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          key: ymd(cur),
          value: 0,
        });
        cur.setDate(cur.getDate() + 1);
        guard++;
      }
      const idx = new Map(days.map((d) => [d.key, d]));
      return { days, idx };
    };
  }, [orders.data, from, to]);

  // Faturamento por dia.
  const revenueSeries = useMemo(() => {
    const { days, idx } = buildDaily();
    for (const o of revenueOrders) {
      const b = idx.get(o.created_at.slice(0, 10));
      if (b) b.value += o.total;
    }
    return days;
  }, [buildDaily, revenueOrders]);

  // Novos clientes por dia (data do 1º pedido de cada cliente).
  const newCustomersSeries = useMemo(() => {
    const firstOrder = new Map<string, string>();
    for (const o of orders.data ?? []) {
      const id = o.customer?.id;
      if (!id) continue;
      const d = o.created_at;
      if (!firstOrder.has(id) || d < firstOrder.get(id)!) firstOrder.set(id, d);
    }
    const { days, idx } = buildDaily();
    for (const [, d] of firstOrder) {
      const b = idx.get(d.slice(0, 10));
      if (b) b.value += 1;
    }
    return days;
  }, [buildDaily, orders.data]);

  // Faturamento por tamanho — receita + %.
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of revenueOrders) {
      for (const it of o.items) {
        const cat = productCategory.get(it.product_id) ?? "Sem tamanho";
        map.set(cat, (map.get(cat) ?? 0) + it.unit_price * it.quantity);
      }
    }
    const total = [...map.values()].reduce((s, v) => s + v, 0) || 1;
    return [...map.entries()]
      .map(([name, revenue]) => ({ name, revenue, pct: Math.round((revenue / total) * 100) }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [revenueOrders, productCategory]);

  // Vendas por sabor — faturamento + %.
  const byFlavor = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of revenueOrders) {
      for (const it of o.items) {
        const flavor = shortFlavor(it.name);
        const e = map.get(flavor) ?? { name: flavor, qty: 0, revenue: 0 };
        e.qty += it.quantity;
        e.revenue += it.unit_price * it.quantity;
        map.set(flavor, e);
      }
    }
    const list = [...map.values()].sort((a, b) => b.revenue - a.revenue);
    const total = list.reduce((s, e) => s + e.revenue, 0) || 1;
    return list.map((e) => ({ ...e, pctLabel: `${Math.round((e.revenue / total) * 100)}%` }));
  }, [revenueOrders]);

  const exportCSV = () => {
    const headers = [
      "Código",
      "Data",
      "Status",
      "Pagamento",
      "Cliente",
      "CPF",
      "Itens",
      "Total (R$)",
    ];
    const rows = filtered.map((o) => [
      o.code,
      new Date(o.created_at).toLocaleString("pt-BR"),
      statusMeta(o.status).label,
      o.payment_method ?? "",
      o.customer?.name ?? "",
      o.customer?.cpf ?? "",
      o.items.map((i) => `${i.quantity}x ${i.name}${i.size ? ` (${i.size})` : ""}`).join("; "),
      brNumber(o.total),
    ]);
    downloadCSV(`pedidos_${from || "inicio"}_a_${to || "hoje"}.csv`, toCSV(headers, rows));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl font-bold tracking-tight">Dashboard</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-800">
            <Radio className="size-3.5" />
            Ao vivo
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["7d", "7 dias"],
              ["30d", "30 dias"],
              ["month", "Mês"],
              ["all", "Tudo"],
              ["custom", "Personalizado"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPreset(key)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                preset === key
                  ? "border-brand-deep bg-brand-deep text-brand-cream"
                  : "border-brand-deep/15 bg-white text-brand-deep hover:border-brand-deep/40"
              }`}
            >
              {label}
            </button>
          ))}
          {preset === "custom" && (
            <div className="flex items-center gap-2 rounded-full border border-brand-deep/15 bg-white px-3 py-1">
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                aria-label="Data inicial"
                className="bg-transparent text-sm text-brand-deep outline-none [color-scheme:light]"
              />
              <span className="text-brand-deep/40">até</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                aria-label="Data final"
                className="bg-transparent text-sm text-brand-deep outline-none [color-scheme:light]"
              />
            </div>
          )}
          <Button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            variant="outline"
            className="rounded-full border-brand-deep/20"
          >
            <Download className="size-4" />
            CSV
          </Button>
        </div>
      </div>

      {/* Métricas do período */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card icon={DollarSign} label="Faturamento" value={formatBRL(metrics.revenue)} />
        <Card icon={ShoppingBag} label="Pedidos" value={String(metrics.count)} />
        <Card icon={TrendingUp} label="Ticket médio" value={formatBRL(metrics.avg)} />
        <Card icon={Users} label="Clientes únicos" value={String(metrics.customers)} />
      </div>

      {/* Entregas pendentes — operação do caixa */}
      <PendingDeliveries orders={orders.data ?? []} />

      {/* Faturamento no tempo */}
      <ChartCard title="Faturamento no período" className="mt-6">
        <TimeArea data={revenueSeries} color="#E8772E" gradId="rev" money />
      </ChartCard>

      {/* Novos clientes no tempo */}
      <ChartCard title="Novos clientes no período" className="mt-6">
        <TimeArea data={newCustomersSeries} color="#7C5CBF" gradId="cli" />
      </ChartCard>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Faturamento por tamanho */}
        <ChartCard title="Faturamento por tamanho">
          {byCategory.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-brand-deep/50">
              Sem dados no período.
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-56 w-full sm:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byCategory}
                      dataKey="revenue"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {byCategory.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [formatBRL(Number(v)), "Faturamento"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legenda com faturamento e % */}
              <ul className="w-full space-y-2 sm:w-1/2">
                {byCategory.map((c, i) => (
                  <li key={c.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                      />
                      {c.name}
                    </span>
                    <span className="text-brand-deep/70">
                      <span className="font-medium">{formatBRL(c.revenue)}</span> · {c.pct}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartCard>

        {/* Vendas por sabor */}
        <ChartCard title="Vendas por sabor">
          <div className="h-72 w-full">
            {byFlavor.length === 0 ? (
              <div className="flex h-full items-center justify-center text-brand-deep/50">
                Sem dados no período.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byFlavor} margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#00000010" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={70}
                    tickFormatter={(v) => formatBRL(Number(v))}
                  />
                  <Tooltip formatter={(v) => [formatBRL(Number(v)), "Faturamento"]} />
                  <Bar dataKey="revenue" barSize={26} radius={[6, 6, 0, 0]}>
                    <LabelList
                      dataKey="pctLabel"
                      position="top"
                      style={{ fontSize: 12, fill: "#1a1a1a", fontWeight: 600 }}
                    />
                    {byFlavor.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

// Gráfico de área reutilizável (faturamento / novos clientes).
function TimeArea({
  data,
  color,
  gradId,
  money,
}: {
  data: { label: string; value: number }[];
  color: string;
  gradId: string;
  money?: boolean;
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.5} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#00000010" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} minTickGap={24} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={money ? 70 : 40}
            allowDecimals={false}
            tickFormatter={(v) => (money ? formatBRL(Number(v)) : String(v))}
          />
          <Tooltip
            formatter={(v) =>
              money ? [formatBRL(Number(v)), "Faturamento"] : [String(v), "Novos clientes"]
            }
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Painel de entregas pendentes com confirmação de finalização.
function PendingDeliveries({ orders }: { orders: AdminOrder[] }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [saving, setSaving] = useState(false);

  // Pendentes de entrega = pedidos PAGOS (aguardando retirada/entrega).
  const pending = useMemo(
    () =>
      orders
        .filter((o) => o.status === "paid")
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [orders],
  );

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
    <div className="mt-6 rounded-2xl border border-brand-deep/10 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <PackageCheck className="size-5 text-accent-orange" />
          Entregas pendentes
        </h2>
        <span className="rounded-full bg-brand-deep/5 px-3 py-1 text-sm font-medium text-brand-deep/70">
          {pending.length}
        </span>
      </div>

      {pending.length === 0 ? (
        <p className="mt-4 text-sm text-brand-deep/60">Nenhuma entrega pendente. Tudo em dia 🎉</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pending.map((o) => {
            const st = statusMeta(o.status);
            const qty = o.items.reduce((s, i) => s + i.quantity, 0);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setSelected(o)}
                className="rounded-xl border border-brand-deep/10 bg-brand-cream/40 p-4 text-left transition hover:border-accent-orange hover:bg-brand-cream"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold">{o.code}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${st.className}`}
                  >
                    {st.label}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-brand-deep/70">
                  {o.customer?.name ?? "—"}
                </p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-brand-deep/60">{qty} item(s)</span>
                  <span className="font-display font-bold">{formatBRL(o.total)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Dialog de resumo + confirmação de entrega */}
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono">{selected?.code}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="rounded-xl border border-brand-deep/10 p-3">
                <p className="font-semibold">{selected.customer?.name}</p>
                <p className="text-brand-deep/60">{selected.customer?.phone}</p>
              </div>
              <OrderItemsList items={selected.items} />
              <div className="flex items-center justify-between border-t border-brand-deep/10 pt-3">
                <span className="text-xs uppercase tracking-widest text-brand-deep/60">Total</span>
                <span className="font-display text-2xl font-bold">{formatBRL(selected.total)}</span>
              </div>
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
              {saving ? "Finalizando..." : "Finalizar pedido (entregue)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-brand-deep/10 bg-white p-5">
      <Icon className="size-6 text-accent-orange" />
      <p className="mt-3 text-xs uppercase tracking-widest text-brand-deep/50">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

function ChartCard({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-brand-deep/10 bg-white p-5 ${className ?? ""}`}>
      <h2 className="mb-4 font-display text-lg font-bold">{title}</h2>
      {children}
    </div>
  );
}
