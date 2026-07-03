import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Copy, QrCode, Check } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell } from "@/components/PageShell";
import { PaymentBrick, type BrickSubmit } from "@/components/PaymentBrick";
import { useCart } from "@/contexts/CartContext";
import { useProductMap } from "@/lib/api/products";
import { processCheckout, type CheckoutResult } from "@/lib/api/payments";
import { formatBRL, type Product } from "@/lib/products";
import { onlyDigits, formatCPF, isValidCPF } from "@/lib/cpf";
import { saveOrderFromApi } from "@/routes/obrigado";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — FreeB" },
      { name: "description", content: "Finalize seu pedido com pagamento via Mercado Pago." },
    ],
  }),
  component: CheckoutPage,
});

const formatPhone = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) =>
      [a && `(${a}`, a?.length === 2 ? ") " : "", b, c && `-${c}`].filter(Boolean).join(""),
    );
  }
  return d.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
};

const schema = z.object({
  name: z.string().trim().min(2, "Informe seu nome completo").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  phone: z
    .string()
    .trim()
    .refine((v) => onlyDigits(v).length >= 10 && onlyDigits(v).length <= 11, "Telefone inválido"),
  cpf: z.string().trim().refine(isValidCPF, "CPF inválido"),
  // LGPD: consentimento explícito para usar os dados no processamento do pedido.
  consent: z.boolean().refine((v) => v, "Autorize o uso dos dados para continuar"),
});

type FormValues = z.infer<typeof schema>;
type FormErrors = Partial<Record<keyof FormValues, string>>;
type Step = "form" | "payment" | "pix";

function CheckoutPage() {
  const { items, clear } = useCart();
  const navigate = useNavigate();
  const { map, isLoading } = useProductMap();
  const [values, setValues] = useState<FormValues>({
    name: "",
    email: "",
    phone: "",
    cpf: "",
    consent: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [step, setStep] = useState<Step>("form");
  const [pix, setPix] = useState<NonNullable<CheckoutResult["payment"]["pix"]> | null>(null);

  const lines = items
    .map((i) => {
      const product = map.get(i.productId);
      return product ? { product, quantity: i.quantity } : null;
    })
    .filter((x): x is { product: Product; quantity: number } => !!x);

  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);

  if (isLoading && items.length > 0) {
    return (
      <PageShell>
        <p className="py-24 text-center text-brand-deep/60">Carregando checkout...</p>
      </PageShell>
    );
  }

  // Depois do Pix, o carrinho é limpo — mostramos a tela do QR mesmo com lines vazio.
  if (lines.length === 0 && step !== "pix") {
    return (
      <PageShell>
        <div className="py-24 text-center">
          <h1 className="font-display text-4xl font-bold">Carrinho vazio</h1>
          <p className="mt-3 text-brand-deep/60">
            Adicione produtos ao carrinho antes de finalizar a compra.
          </p>
          <Button
            onClick={() => navigate({ to: "/" })}
            className="mt-8 rounded-full bg-accent-orange text-brand-deep hover:bg-accent-orange/90"
          >
            Ver catálogo
          </Button>
        </div>
      </PageShell>
    );
  }

  const setField = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const goToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const result = schema.safeParse(values);
    if (!result.success) {
      const next: FormErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof FormValues;
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setValues(result.data);
    setStep("payment");
  };

  // Chamado pelo Payment Brick. Cria pedido + processa pagamento no servidor.
  const handlePayment = async ({ formData }: BrickSubmit) => {
    let result: CheckoutResult;
    try {
      result = await processCheckout({
        data: {
          customer: {
            name: values.name,
            email: values.email,
            phone: values.phone,
            cpf: values.cpf,
          },
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          payment: formData,
          consent: values.consent,
        },
      });
    } catch (err) {
      const limited = err instanceof Error && err.message.includes("rate_limited");
      toast.error(
        limited ? "Muitas tentativas seguidas" : "Não foi possível processar o pagamento",
        {
          description: limited
            ? "Aguarde um minuto e tente novamente."
            : "Tente novamente em instantes.",
        },
      );
      throw err; // faz o Brick exibir estado de erro
    }

    const { order, payment } = result;
    saveOrderFromApi(order, {
      name: values.name,
      email: values.email,
      phone: values.phone,
      cpf: values.cpf,
    });

    if (payment.method === "pix" && payment.pix) {
      setPix(payment.pix);
      setStep("pix");
      clear();
      return;
    }
    if (payment.status === "approved") {
      toast.success("Pagamento aprovado!");
      clear();
      navigate({ to: "/obrigado" });
      return;
    }
    if (payment.status === "rejected") {
      toast.error("Pagamento recusado", { description: "Tente outro cartão ou método." });
      throw new Error("rejected");
    }
    toast("Pagamento pendente", { description: "Avisaremos assim que for confirmado." });
    clear();
    navigate({ to: "/obrigado" });
  };

  // ── Tela do Pix ─────────────────────────────────────────────────────────────
  if (step === "pix" && pix) {
    return (
      <PageShell>
        <div className="mx-auto max-w-md py-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent-orange/20 text-accent-orange">
            <QrCode className="size-7" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold">Pague com Pix</h1>
          <p className="mt-2 text-brand-deep/60">
            Escaneie o QR code no app do seu banco ou copie o código.
          </p>

          {pix.qr_code_base64 && (
            <img
              src={`data:image/png;base64,${pix.qr_code_base64}`}
              alt="QR code do Pix"
              className="mx-auto mt-6 size-56 rounded-xl border border-brand-deep/10 bg-white p-2"
            />
          )}

          {pix.qr_code && <CopyPix code={pix.qr_code} />}

          <p className="mt-6 text-sm text-brand-deep/60">
            Assim que o pagamento for confirmado, seu pedido é atualizado automaticamente. Você pode
            acompanhar em "Meus pedidos".
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              className="flex-1 rounded-full bg-accent-orange text-brand-deep hover:bg-accent-orange/90"
            >
              <Link to="/meus-pedidos">Meus pedidos</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1 rounded-full border-brand-deep/20">
              <Link to="/">Voltar ao catálogo</Link>
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <button
        type="button"
        onClick={() => (step === "payment" ? setStep("form") : navigate({ to: "/carrinho" }))}
        className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-brand-deep/70 hover:text-accent-orange"
      >
        <ArrowLeft className="size-4" />{" "}
        {step === "payment" ? "Voltar aos dados" : "Voltar ao carrinho"}
      </button>

      <h1 className="mt-4 font-display text-5xl font-bold tracking-tight md:text-6xl">Checkout</h1>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {step === "form" ? (
            <form onSubmit={goToPayment} noValidate className="space-y-6">
              <section className="rounded-2xl border border-brand-deep/10 bg-white p-6">
                <h2 className="font-display text-2xl font-bold">Seus dados</h2>
                <p className="mt-1 text-sm text-brand-deep/60">
                  Usaremos para emitir e acompanhar seu pedido.
                </p>

                <div className="mt-6 grid gap-4">
                  <Field label="Nome completo" error={errors.name} htmlFor="name">
                    <Input
                      id="name"
                      autoComplete="name"
                      value={values.name}
                      onChange={(e) => setField("name", e.target.value)}
                      maxLength={100}
                    />
                  </Field>

                  <Field label="E-mail" error={errors.email} htmlFor="email">
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={values.email}
                      onChange={(e) => setField("email", e.target.value)}
                      maxLength={255}
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Telefone / WhatsApp" error={errors.phone} htmlFor="phone">
                      <Input
                        id="phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="(11) 99999-9999"
                        value={values.phone}
                        onChange={(e) => setField("phone", formatPhone(e.target.value))}
                      />
                    </Field>
                    <Field label="CPF" error={errors.cpf} htmlFor="cpf">
                      <Input
                        id="cpf"
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                        value={values.cpf}
                        onChange={(e) => setField("cpf", formatCPF(e.target.value))}
                      />
                    </Field>
                  </div>
                </div>

                {/* Consentimento LGPD */}
                <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-brand-deep/10 bg-brand-cream/40 p-4 text-sm">
                  <input
                    type="checkbox"
                    checked={values.consent}
                    onChange={(e) => setField("consent", e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-brand-deep"
                  />
                  <span className="text-brand-deep/80">
                    Autorizo o uso dos meus dados (nome, CPF, e-mail e telefone) para processar e
                    acompanhar este pedido, conforme a{" "}
                    <abbr title="Lei Geral de Proteção de Dados">LGPD</abbr>. Os dados não são
                    compartilhados para outros fins.
                  </span>
                </label>
                {errors.consent && (
                  <p className="mt-2 text-xs font-medium text-destructive">{errors.consent}</p>
                )}
              </section>

              <Button
                type="submit"
                className="w-full rounded-full bg-brand-deep py-6 text-sm font-bold uppercase tracking-widest text-brand-cream hover:bg-brand-deep/90"
              >
                Continuar para pagamento
              </Button>
            </form>
          ) : (
            <section className="rounded-2xl border border-brand-deep/10 bg-white p-6">
              <h2 className="font-display text-2xl font-bold">Pagamento</h2>
              <p className="mt-1 mb-6 text-sm text-brand-deep/60">
                Cartão ou Pix, processado com segurança pelo Mercado Pago.
              </p>
              <PaymentBrick amount={subtotal} payerEmail={values.email} onSubmit={handlePayment} />
            </section>
          )}
        </div>

        <aside className="h-fit rounded-2xl border border-brand-deep/10 bg-white p-6">
          <h2 className="font-display text-2xl font-bold">Pedido</h2>
          <ul className="mt-4 divide-y divide-brand-deep/10">
            {lines.map(({ product, quantity }) => (
              <li key={product.id} className="flex items-center gap-3 py-3">
                <div className="size-14 overflow-hidden rounded-lg bg-brand-deep/5">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <p className="font-medium leading-tight">{product.name}</p>
                  <p className="text-xs text-brand-deep/60">
                    {quantity} × {formatBRL(product.price)}
                  </p>
                </div>
                <span className="text-sm font-semibold">{formatBRL(product.price * quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-end justify-between border-t border-brand-deep/10 pt-4">
            <span className="text-sm uppercase tracking-widest text-brand-deep/60">Total</span>
            <span className="font-display text-3xl font-bold">{formatBRL(subtotal)}</span>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}

function CopyPix({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 rounded-xl border border-brand-deep/10 bg-brand-deep/5 p-3">
        <span className="flex-1 truncate font-mono text-xs text-brand-deep/70">{code}</span>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 rounded-full border-brand-deep/20"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              toast.success("Código Pix copiado");
              setTimeout(() => setCopied(false), 2000);
            } catch {
              toast.error("Não foi possível copiar");
            }
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={htmlFor}
        className="text-xs font-semibold uppercase tracking-widest text-brand-deep/70"
      >
        {label}
      </Label>
      {children}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
