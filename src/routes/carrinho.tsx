import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Trash2, ShoppingBag, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/PageShell";
import { QuantitySelector } from "@/components/QuantitySelector";
import { useCart } from "@/contexts/CartContext";
import { useProductMap } from "@/lib/api/products";
import { formatBRL, type Product } from "@/lib/products";

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Carrinho — FreeB" },
      { name: "description", content: "Revise seus sucos selecionados e siga para o pagamento." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { items, updateQuantity, removeItem, clear } = useCart();
  const navigate = useNavigate();
  const { map, isLoading } = useProductMap();

  const lines = items
    .map((i) => {
      const product = map.get(i.productId);
      return product ? { product, quantity: i.quantity } : null;
    })
    .filter((x): x is { product: Product; quantity: number } => !!x);

  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);

  return (
    <PageShell>
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-brand-deep/70 hover:text-accent-orange"
      >
        <ArrowLeft className="size-4" /> Continuar comprando
      </Link>

      <h1 className="mt-4 font-display text-5xl font-bold tracking-tight md:text-6xl">
        Seu carrinho
      </h1>

      {isLoading && items.length > 0 ? (
        <div className="mt-16 flex flex-col items-center gap-4 rounded-2xl border border-brand-deep/10 bg-white p-12 text-center">
          <p className="text-brand-deep/60">Carregando seu carrinho...</p>
        </div>
      ) : lines.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-6 rounded-2xl border border-brand-deep/10 bg-white p-12 text-center">
          <ShoppingBag className="size-12 text-brand-deep/40" />
          <div>
            <p className="font-display text-2xl font-bold">Seu carrinho está vazio</p>
            <p className="mt-2 text-brand-deep/60">
              Explore o catálogo e adicione seus sucos preferidos.
            </p>
          </div>
          <Button
            onClick={() => navigate({ to: "/" })}
            className="rounded-full bg-accent-orange text-brand-deep hover:bg-accent-orange/90"
          >
            Ver catálogo
          </Button>
        </div>
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {lines.map(({ product, quantity }) => (
              <div
                key={product.id}
                className="flex gap-4 rounded-2xl border border-brand-deep/10 bg-white p-4"
              >
                <div className="size-24 shrink-0 overflow-hidden rounded-xl bg-brand-deep/5">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-full w-full object-cover"
                    width={96}
                    height={96}
                  />
                </div>
                <div className="flex flex-1 flex-col justify-between gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-xl font-bold leading-tight">
                        {product.name}
                      </h3>
                      <p className="text-sm text-brand-deep/60">{product.volume}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(product.id)}
                      aria-label={`Remover ${product.name}`}
                      className="rounded-full p-2 text-brand-deep/60 transition hover:bg-brand-deep/5 hover:text-brand-deep"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <QuantitySelector
                      value={quantity}
                      onChange={(v) => updateQuantity(product.id, v)}
                      size="sm"
                    />
                    <span className="font-display text-lg font-bold">
                      {formatBRL(product.price * quantity)}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={clear}
              className="text-sm text-brand-deep/60 underline-offset-4 hover:text-brand-deep hover:underline"
            >
              Esvaziar carrinho
            </button>
          </div>

          <aside className="h-fit rounded-2xl border border-brand-deep/10 bg-white p-6">
            <h2 className="font-display text-2xl font-bold">Resumo</h2>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-brand-deep/60">Subtotal</dt>
                <dd className="font-medium">{formatBRL(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-brand-deep/60">Entrega</dt>
                <dd className="font-medium">Retirada no local</dd>
              </div>
            </dl>
            <div className="mt-6 flex items-end justify-between border-t border-brand-deep/10 pt-4">
              <span className="text-sm uppercase tracking-widest text-brand-deep/60">Total</span>
              <span className="font-display text-3xl font-bold">{formatBRL(subtotal)}</span>
            </div>
            <Button
              onClick={() => navigate({ to: "/checkout" })}
              className="mt-6 w-full rounded-full bg-brand-deep py-6 text-sm font-bold uppercase tracking-widest text-brand-cream hover:bg-brand-deep/90"
            >
              Ir para o checkout
            </Button>
            <p className="mt-3 text-center text-xs text-brand-deep/60">
              Pagamento processado via Mercado Pago
            </p>
          </aside>
        </div>
      )}
    </PageShell>
  );
}
