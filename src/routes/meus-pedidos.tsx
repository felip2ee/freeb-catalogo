import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mail, KeyRound, Package, RotateCcw, Receipt, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell } from "@/components/PageShell";
import { OrderItemsList } from "@/components/OrderItemsList";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/lib/supabase";
import { getMyOrders, type CustomerHistory } from "@/lib/api/customers";
import { formatBRL } from "@/lib/products";
import { statusMeta } from "@/lib/order-status";
import { saveOrderFromApi } from "@/routes/obrigado";

export const Route = createFileRoute("/meus-pedidos")({
  head: () => ({
    meta: [
      { title: "Meus pedidos — FreeB" },
      {
        name: "description",
        content: "Consulte o histórico dos seus pedidos com um código enviado ao seu e-mail.",
      },
    ],
  }),
  component: MyOrdersPage,
});

type Step = "email" | "code" | "list";

function MyOrdersPage() {
  const navigate = useNavigate();
  const { addItem, clear } = useCart();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [result, setResult] = useState<CustomerHistory | null>(null);

  // Busca o histórico com o token da sessão verificada.
  const fetchHistory = async (accessToken: string) => {
    const data = await getMyOrders({ data: { accessToken } });
    setResult(data);
    setStep("list");
  };

  // Sessão já verificada antes (ex.: voltou à página) → pula o OTP.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session && active) {
          setEmail(session.user.email ?? "");
          await fetchHistory(session.access_token);
        }
      } catch {
        // sessão inválida/expirada → segue no passo de e-mail
      } finally {
        if (active) setCheckingSession(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) {
      setError("E-mail inválido");
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({ email: addr });
      if (otpErr) throw otpErr;
      setEmail(addr);
      setStep("code");
      toast.success("Código enviado!", {
        description: `Confira a caixa de entrada de ${addr}.`,
      });
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "";
      toast.error("Não foi possível enviar o código", {
        description: msg.includes("rate")
          ? "Muitos envios seguidos — aguarde um minuto."
          : "Verifique o e-mail e tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = code.replace(/\D/g, "");
    if (token.length !== 6) {
      setError("Digite o código de 6 dígitos");
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      const { data, error: vErr } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      if (vErr || !data.session) throw vErr ?? new Error("no_session");
      await fetchHistory(data.session.access_token);
    } catch (err) {
      console.error(err);
      toast.error("Código inválido ou expirado", {
        description: "Confira o código ou peça um novo.",
      });
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setResult(null);
    setCode("");
    setStep("email");
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

      {checkingSession ? (
        <p className="mt-8 text-brand-deep/60">Carregando...</p>
      ) : step === "email" ? (
        <>
          <p className="mt-3 text-brand-deep/70">
            Digite o e-mail usado na compra. Enviaremos um código de 6 dígitos para confirmar que é
            você — só assim seu histórico fica protegido.
          </p>
          <form
            onSubmit={sendCode}
            noValidate
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-widest text-brand-deep/70"
              >
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
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
              <Mail className="size-4" />
              {loading ? "Enviando..." : "Enviar código"}
            </Button>
          </form>
        </>
      ) : step === "code" ? (
        <>
          <p className="mt-3 text-brand-deep/70">
            Enviamos um código de 6 dígitos para <strong>{email}</strong>. Digite-o abaixo.
          </p>
          <form
            onSubmit={verifyCode}
            noValidate
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-1.5">
              <Label
                htmlFor="code"
                className="text-xs font-semibold uppercase tracking-widest text-brand-deep/70"
              >
                Código
              </Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  if (error) setError(undefined);
                }}
                className="font-mono text-lg tracking-[0.4em]"
              />
              {error && <p className="text-xs font-medium text-destructive">{error}</p>}
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-full bg-brand-deep px-8 py-6 text-sm font-bold uppercase tracking-widest text-brand-cream hover:bg-brand-deep/90"
            >
              <KeyRound className="size-4" />
              {loading ? "Verificando..." : "Confirmar"}
            </Button>
          </form>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
            }}
            className="mt-4 text-sm text-brand-deep/60 underline-offset-4 hover:text-brand-deep hover:underline"
          >
            Trocar e-mail ou reenviar código
          </button>
        </>
      ) : (
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-brand-deep/70">
              Conectado como <strong>{email}</strong>
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              className="rounded-full border-brand-deep/20"
            >
              <LogOut className="size-4" />
              Sair
            </Button>
          </div>

          {!result || result.orders.length === 0 ? (
            <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-brand-deep/10 bg-white p-12 text-center">
              <Package className="size-12 text-brand-deep/40" />
              <div>
                <p className="font-display text-xl font-bold">Nenhum pedido encontrado</p>
                <p className="mt-2 text-brand-deep/60">Não encontramos pedidos para esse e-mail.</p>
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
