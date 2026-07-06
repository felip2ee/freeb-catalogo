import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, CheckCircle2, Clock, XCircle, Home, MapPin, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/PageShell";
import { useProductMap } from "@/lib/api/products";
import { formatBRL } from "@/lib/products";
import { statusMeta } from "@/lib/order-status";
import { PICKUP_MAPS_URL } from "@/lib/pickup";

export const Route = createFileRoute("/obrigado")({
  head: () => ({
    meta: [
      { title: "Pedido confirmado — FreeB" },
      { name: "description", content: "Obrigado pelo seu pedido. Guarde seu comprovante." },
    ],
  }),
  component: ThankYouPage,
});

const STORAGE_KEY = "freeb-last-order-v1";

interface OrderLine {
  productId: string;
  quantity: number;
  unitPrice: number;
  name: string;
  size?: string | null;
}

export interface SavedOrder {
  code: string;
  createdAt: string;
  status?: string; // pending | paid | preparing | delivered | canceled
  customer: { name: string; email: string; phone: string; cpf: string };
  lines: OrderLine[];
  total: number;
}

export function saveLastOrder(order: SavedOrder) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    // ignore
  }
}

// Formato de pedido que as APIs retornam (create_order / histórico por CPF).
export interface ApiOrderLike {
  code: string;
  created_at: string;
  status?: string;
  total: number;
  items: {
    product_id: string;
    name: string;
    unit_price: number;
    quantity: number;
    size?: string | null;
  }[];
}

// Converte um pedido da API no SavedOrder do comprovante e persiste.
// Usado pelo checkout e pelo /meus-pedidos (reabrir comprovante).
export function saveOrderFromApi(order: ApiOrderLike, customer: SavedOrder["customer"]) {
  saveLastOrder({
    code: order.code,
    createdAt: order.created_at,
    status: order.status,
    customer,
    lines: order.items.map((it) => ({
      productId: it.product_id,
      quantity: it.quantity,
      unitPrice: it.unit_price,
      name: it.name,
      size: it.size ?? null,
    })),
    total: order.total,
  });
}

function ThankYouPage() {
  const [order, setOrder] = useState<SavedOrder | null>(null);
  const { map } = useProductMap();

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setOrder(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  if (!order) {
    return (
      <PageShell mainClassName="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-4xl font-bold">Nenhum pedido encontrado</h1>
        <p className="mt-3 text-brand-deep/60">
          Faça um novo pedido para visualizar o comprovante.
        </p>
        <Button
          asChild
          className="mt-8 rounded-full bg-accent-orange text-brand-deep hover:bg-accent-orange/90"
        >
          <Link to="/">Ver catálogo</Link>
        </Button>
      </PageShell>
    );
  }

  const createdAt = new Date(order.createdAt);
  const dateStr = createdAt.toLocaleDateString("pt-BR");
  const timeStr = createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const status = order.status ?? "pending";
  const meta = statusMeta(status);
  const isPaid = ["paid", "preparing", "delivered"].includes(status);
  const isCanceled = status === "canceled";

  const StatusIcon = isCanceled ? XCircle : isPaid ? CheckCircle2 : Clock;
  const iconTone = isCanceled
    ? "bg-red-500/15 text-red-700"
    : isPaid
      ? "bg-accent-orange/20 text-accent-orange"
      : "bg-accent-gold/20 text-brand-deep";
  const heading = isCanceled
    ? "Pedido cancelado"
    : isPaid
      ? "Pagamento confirmado!"
      : "Pedido registrado!";
  const subtext = isCanceled
    ? "Este pedido foi cancelado. Se achar que é engano, fale com a gente pelo WhatsApp."
    : isPaid
      ? "Seu pedido está confirmado. É só retirar no local quando estiver pronto — apresente este comprovante."
      : "Recebemos seu pedido. Assim que o pagamento for confirmado, ele é liberado para retirada. Acompanhe em Meus pedidos.";

  return (
    <PageShell mainClassName="mx-auto max-w-2xl px-6 py-12 md:py-16">
      <div className="flex flex-col items-center text-center">
        <div className={`flex size-16 items-center justify-center rounded-full ${iconTone}`}>
          <StatusIcon className="size-9" />
        </div>
        <h1 className="mt-5 font-display text-4xl font-bold tracking-tight md:text-5xl">
          {heading}
        </h1>
        <p className="mt-3 max-w-md text-brand-deep/70">{subtext}</p>

        {!isCanceled && (
          <>
            <div className="mt-6 flex items-center gap-2 rounded-full bg-brand-deep px-4 py-2 text-xs font-bold uppercase tracking-widest text-brand-cream">
              <Camera className="size-4" />
              Tire um print deste ticket
            </div>
            <p className="mt-2 max-w-sm text-sm text-brand-deep/60">
              Salve este comprovante na galeria do seu celular — você pode precisar dele para
              retirar o pedido.
            </p>
          </>
        )}
      </div>

      {/* Ticket */}
      <div className="relative mx-auto mt-10 max-w-md">
        {/* Top notch / serration */}
        <TicketEdge position="top" />

        <article className="relative bg-white px-6 py-8 shadow-xl shadow-brand-deep/10">
          <header className="flex items-start justify-between border-b border-dashed border-brand-deep/20 pb-4">
            <div>
              <p className="font-display text-2xl font-bold leading-none">FreeB</p>
              <p className="mt-1 text-[11px] uppercase tracking-widest text-brand-deep/60">
                Comprovante de pedido
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-brand-deep/50">Pedido</p>
              <p className="font-mono text-base font-bold">{order.code}</p>
              <span
                className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${meta.className}`}
              >
                {meta.label}
              </span>
            </div>
          </header>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="uppercase tracking-widest text-brand-deep/50">Data</dt>
              <dd className="mt-1 font-medium">{dateStr}</dd>
            </div>
            <div className="text-right">
              <dt className="uppercase tracking-widest text-brand-deep/50">Hora</dt>
              <dd className="mt-1 font-medium">{timeStr}</dd>
            </div>
            <div className="col-span-2">
              <dt className="uppercase tracking-widest text-brand-deep/50">Cliente</dt>
              <dd className="mt-1 font-medium">{order.customer.name}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-widest text-brand-deep/50">E-mail</dt>
              <dd className="mt-1 break-all font-medium">{order.customer.email}</dd>
            </div>
            <div className="text-right">
              <dt className="uppercase tracking-widest text-brand-deep/50">WhatsApp</dt>
              <dd className="mt-1 font-medium">{order.customer.phone}</dd>
            </div>
            <div className="col-span-2">
              <dt className="uppercase tracking-widest text-brand-deep/50">CPF</dt>
              <dd className="mt-1 font-mono font-medium">{order.customer.cpf}</dd>
            </div>
          </dl>

          <div className="my-5 border-t border-dashed border-brand-deep/20" />

          <ul className="space-y-2 text-sm">
            {order.lines.map((line) => {
              const size = line.size ?? map.get(line.productId)?.volume;
              return (
                <li key={line.productId} className="flex items-baseline justify-between gap-3">
                  <span className="flex-1">
                    <span className="font-mono text-xs text-brand-deep/60">
                      {String(line.quantity).padStart(2, "0")}×
                    </span>{" "}
                    {line.name}
                    {size && <span className="text-xs text-brand-deep/50"> · {size}</span>}
                  </span>
                  <span className="font-mono font-medium">
                    {formatBRL(line.unitPrice * line.quantity)}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="my-5 border-t border-dashed border-brand-deep/20" />

          <div className="flex items-end justify-between">
            <span className="text-xs uppercase tracking-widest text-brand-deep/60">Total</span>
            <span className="font-display text-3xl font-bold">{formatBRL(order.total)}</span>
          </div>

          <div className="mt-6 rounded-md bg-brand-deep/5 px-3 py-2 text-center text-[11px] uppercase tracking-widest text-brand-deep/60">
            {isPaid
              ? "Pagamento confirmado · Retirada no local"
              : isCanceled
                ? "Pedido cancelado"
                : "Aguardando pagamento · Mercado Pago"}
          </div>

          <p className="mt-5 text-center font-display text-sm italic text-brand-deep/60">
            Obrigado por escolher o que é puro 🍊
          </p>
        </article>

        <TicketEdge position="bottom" />
      </div>

      {!isCanceled && (
        <a
          href={PICKUP_MAPS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-auto mt-8 flex max-w-md items-center gap-3 rounded-2xl border border-brand-deep/10 bg-white p-4 transition hover:border-accent-orange/40 hover:shadow-md"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-orange/20 text-accent-orange">
            <MapPin className="size-5" />
          </span>
          <span className="flex-1">
            <span className="block font-display text-base font-bold">Local de retirada</span>
            <span className="block text-sm text-brand-deep/60">
              Toque para abrir a rota no Google Maps
            </span>
          </span>
        </a>
      )}

      <div className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row">
        <Button
          asChild
          className="flex-1 rounded-full bg-accent-orange text-brand-deep hover:bg-accent-orange/90"
        >
          <Link to="/">
            <Home className="size-4" />
            Voltar ao catálogo
          </Link>
        </Button>
        <Button asChild variant="outline" className="flex-1 rounded-full border-brand-deep/20">
          <Link to="/meus-pedidos">
            <Package className="size-4" />
            Meus pedidos
          </Link>
        </Button>
      </div>
    </PageShell>
  );
}

function TicketEdge({ position }: { position: "top" | "bottom" }) {
  // Serrated edge using radial-gradient cutouts
  const style: React.CSSProperties = {
    backgroundImage:
      "radial-gradient(circle at 8px 8px, var(--brand-cream, #faf5ea) 7px, white 7.5px)",
    backgroundSize: "16px 16px",
    backgroundRepeat: "repeat-x",
    backgroundPosition: position === "top" ? "0 0" : "0 100%",
  };
  return <div aria-hidden className="h-4 w-full" style={style} />;
}
