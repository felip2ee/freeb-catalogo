import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, Package, RotateCcw, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useCart } from "@/contexts/CartContext";
import { getCustomerHistory, type CustomerHistory } from "@/lib/api/customers";
import { formatCPF, isValidCPF } from "@/lib/cpf";
import { formatBRL } from "@/lib/products";
import { statusMeta } from "@/lib/order-status";
import { saveLastOrder } from "@/routes/obrigado";

export const Route = createFileRoute("/meus-pedidos")({
  head: () => ({
    meta: [
      { title: "Meus pedidos — FreeB" },
      {
        name: "description",
        content: "Consulte o histórico dos seus pedidos pelo CPF.",
      },
    ],
  }),
  component: MyOrdersPage,
});

function MyOrdersPage() {
  const navigate = useNavigate();
  const { addItem, clear } = useCart();
  const [cpf, setCpf] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CustomerHistory | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidCPF(cpf)) {
      setError("CPF inválido");
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      const data = await getCustomerHistory({ data: { cpf } });
      setResult(data);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível consultar", {
        description: "Tente novamente em instantes.",
      });
    } finally {
      setLoading(false);
    }
  };

  const openReceipt = (order: NonNullable<CustomerHistory["orders"]>[number]) => {
    if (!result?.customer) return;
    saveLastOrder({
      code: order.code,
      createdAt: order.created_at,
      customer: result.customer,
      lines: order.items.map((it) => ({
        productId: it.product_id,
        quantity: it.quantity,
        unitPrice: it.unit_price,
        name: it.name,
      })),
      total: order.total,
    });
    navigate({ to: "/obrigado" });
  };

  const reorder = (order: NonNullable<CustomerHistory["orders"]>[number]) => {
    clear();
    for (const it of order.items) addItem(it.product_id, it.quantity);
    toast.success("Itens adicionados ao carrinho", {
      description: "Revise e finalize quando quiser.",
    });
    navigate({ to: "/carrinho" });
  };

  return (
    <div className="min-h-screen bg-brand-cream font-sans text-brand-deep">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-5xl font-bold tracking-tight md:text-6xl">Meus pedidos</h1>
        <p className="mt-3 text-brand-deep/70">
          Digite o CPF usado na compra para ver seu histórico e reabrir comprovantes.
        </p>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1 space-y-1.5">
            <Label
              htmlFor="cpf"
              className="text-xs font-semibold uppercase tracking-widest text-brand-deep/70"
            >
              CPF
            </Label>
            <Input
              id="cpf"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => {
                setCpf(formatCPF(e.target.value));
                if (error) setError(undefined);
              }}
            />
            {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="rounded-full bg-brand-deep px-8 py-6 text-sm font-bold uppercase tracking-widest text-brand-cream hover:bg-brand-deep/90"
          >
            <Search className="size-4" />
            {loading ? "Buscando..." : "Buscar"}
          </Button>
        </form>

        {result && (
          <section className="mt-12">
            {result.orders.length === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-brand-deep/10 bg-white p-12 text-center">
                <Package className="size-12 text-brand-deep/40" />
                <div>
                  <p className="font-display text-xl font-bold">Nenhum pedido encontrado</p>
                  <p className="mt-2 text-brand-deep/60">Não encontramos pedidos para esse CPF.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline justify-between border-b border-brand-deep/10 pb-4">
                  <h2 className="font-display text-2xl font-bold">
                    {result.customer?.name?.split(" ")[0]
                      ? `Olá, ${result.customer.name.split(" ")[0]}`
                      : "Seu histórico"}
                  </h2>
                  <span className="text-sm text-brand-deep/60">
                    {result.orders.length} pedido{result.orders.length > 1 ? "s" : ""}
                  </span>
                </div>

                <ul className="mt-6 space-y-4">
                  {result.orders.map((order) => {
                    const status = statusMeta(order.status);
                    const created = new Date(order.created_at);
                    return (
                      <li
                        key={order.id}
                        className="rounded-2xl border border-brand-deep/10 bg-white p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-sm font-bold">{order.code}</p>
                            <p className="mt-0.5 text-xs text-brand-deep/60">
                              {created.toLocaleDateString("pt-BR")} ·{" "}
                              {created.toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </div>

                        <ul className="mt-4 space-y-1.5 text-sm">
                          {order.items.map((it) => (
                            <li
                              key={it.product_id}
                              className="flex items-baseline justify-between gap-3"
                            >
                              <span className="flex-1 text-brand-deep/80">
                                <span className="font-mono text-xs text-brand-deep/50">
                                  {String(it.quantity).padStart(2, "0")}×
                                </span>{" "}
                                {it.name}
                              </span>
                              <span className="font-mono text-brand-deep/70">
                                {formatBRL(it.unit_price * it.quantity)}
                              </span>
                            </li>
                          ))}
                        </ul>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-brand-deep/10 pt-4">
                          <span className="font-display text-xl font-bold">
                            {formatBRL(order.total)}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openReceipt(order)}
                              className="rounded-full border-brand-deep/20"
                            >
                              <Receipt className="size-4" />
                              Comprovante
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => reorder(order)}
                              className="rounded-full bg-accent-orange text-brand-deep hover:bg-accent-orange/90"
                            >
                              <RotateCcw className="size-4" />
                              Pedir de novo
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
