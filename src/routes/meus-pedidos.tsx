import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, Package, RotateCcw, Receipt, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell } from "@/components/PageShell";
import { OrderItemsList } from "@/components/OrderItemsList";
import { useCart } from "@/contexts/CartContext";
import { getMyOrders, type CustomerHistory } from "@/lib/api/customers";
import { formatBRL } from "@/lib/products";
import { statusMeta } from "@/lib/order-status";
import { onlyDigits, formatCPF, isValidCPF } from "@/lib/cpf";
import { saveOrderFromApi } from "@/routes/obrigado";

export const Route = createFileRoute("/meus-pedidos")({
  head: () => ({
    meta: [
      { title: "Meus pedidos — FreeB" },
      {
        name: "description",
        content: "Consulte o histórico dos seus pedidos informando CPF e telefone da compra.",
      },
    ],
  }),
  component: MyOrdersPage,
});

// Máscara de telefone BR — mesma do checkout.
const formatPhone = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) =>
      [a && `(${a}`, a?.length === 2 ? ") " : "", b, c && `-${c}`].filter(Boolean).join(""),
    );
  }
  return d.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
};

function MyOrdersPage() {
  const navigate = useNavigate();
  const { addItem, clear } = useCart();

  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [errCpf, setErrCpf] = useState<string | undefined>();
  const [errPhone, setErrPhone] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CustomerHistory | null>(null);

  const consult = async (e: React.FormEvent) => {
    e.preventDefault();
    let bad = false;
    if (!isValidCPF(cpf)) {
      setErrCpf("CPF inválido");
      bad = true;
    }
    const phoneLen = onlyDigits(phone).length;
    if (phoneLen < 10 || phoneLen > 11) {
      setErrPhone("Telefone inválido");
      bad = true;
    }
    if (bad) return;

    setLoading(true);
    try {
      const data = await getMyOrders({ data: { cpf, phone } });
      if (!data.customer) {
        toast.error("Nenhum pedido encontrado", {
          description: "Confira o CPF e o telefone usados na compra.",
        });
        return;
      }
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

  const newQuery = () => {
    setResult(null);
    setPhone("");
    setErrCpf(undefined);
    setErrPhone(undefined);
  };

  const openReceipt = (order: NonNullable<CustomerHistory["orders"]>[number]) => {
    if (!result?.customer) return;
    saveOrderFromApi(order, result.customer);
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
    <PageShell mainClassName="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-5xl font-bold tracking-tight md:text-6xl">Meus pedidos</h1>

      {!result ? (
        <>
          <p className="mt-3 text-brand-deep/70">
            Informe o <strong>CPF</strong> e o <strong>telefone</strong> usados na compra para
            consultar seu histórico de pedidos.
          </p>
          <form onSubmit={consult} noValidate className="mt-8 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
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
                    if (errCpf) setErrCpf(undefined);
                  }}
                />
                {errCpf && <p className="text-xs font-medium text-destructive">{errCpf}</p>}
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="phone"
                  className="text-xs font-semibold uppercase tracking-widest text-brand-deep/70"
                >
                  Telefone
                </Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => {
                    setPhone(formatPhone(e.target.value));
                    if (errPhone) setErrPhone(undefined);
                  }}
                />
                {errPhone && <p className="text-xs font-medium text-destructive">{errPhone}</p>}
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-full bg-brand-deep px-8 py-6 text-sm font-bold uppercase tracking-widest text-brand-cream hover:bg-brand-deep/90"
            >
              <Search className="size-4" />
              {loading ? "Consultando..." : "Consultar pedidos"}
            </Button>
          </form>
        </>
      ) : (
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-brand-deep/70">
              Histórico de <strong>{result.customer?.name}</strong>
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={newQuery}
              className="rounded-full border-brand-deep/20"
            >
              <ArrowLeft className="size-4" />
              Nova consulta
            </Button>
          </div>

          {result.orders.length === 0 ? (
            <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-brand-deep/10 bg-white p-12 text-center">
              <Package className="size-12 text-brand-deep/40" />
              <div>
                <p className="font-display text-xl font-bold">Nenhum pedido encontrado</p>
                <p className="mt-2 text-brand-deep/60">Esse cadastro ainda não tem pedidos.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-8 flex items-baseline justify-between border-b border-brand-deep/10 pb-4">
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

                      <div className="mt-4">
                        <OrderItemsList items={order.items} />
                      </div>

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
    </PageShell>
  );
}
