import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { formatBRL, type Product } from "@/lib/products";

const accentMap = {
  orange: {
    text: "text-accent-orange",
    bg: "bg-accent-orange/10",
    button: "bg-accent-orange text-brand-deep hover:bg-accent-orange/90",
  },
  pink: {
    text: "text-accent-pink",
    bg: "bg-accent-pink/10",
    button: "bg-accent-pink text-brand-deep hover:bg-accent-pink/90",
  },
  gold: {
    text: "text-accent-gold",
    bg: "bg-accent-gold/10",
    button: "bg-accent-gold text-brand-deep hover:bg-accent-gold/90",
  },
  purple: {
    text: "text-accent-purple",
    bg: "bg-accent-purple/10",
    button: "bg-accent-purple text-brand-cream hover:bg-accent-purple/90",
  },
} as const;

export function ProductCard({ product }: { product: Product }) {
  const colors = accentMap[product.accent];
  const { items, addItem, updateQuantity } = useCart();
  const inCart = items.find((i) => i.productId === product.id)?.quantity ?? 0;

  const handleAdd = () => {
    addItem(product.id, 1);
    toast.success(`${product.name} adicionado`, {
      description: product.volume,
    });
  };

  return (
    <div className="group flex gap-3 rounded-2xl border border-brand-deep/10 bg-white p-3 transition-shadow hover:shadow-md sm:gap-4 sm:p-4">
      {/* Texto à esquerda (estilo iFood) */}
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="font-display text-lg font-bold leading-tight text-brand-deep">
          {product.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-brand-deep/60">{product.description}</p>
        <span className="mt-1 text-xs text-brand-deep/50">{product.volume}</span>
        <div className="mt-auto pt-3">
          <span className={`font-display text-xl font-bold ${colors.text}`}>
            {formatBRL(product.price)}
          </span>
        </div>
      </div>

      {/* Foto quadrada à direita + botão flutuante */}
      <div className="relative shrink-0 self-center">
        <div
          className={`size-28 overflow-hidden rounded-xl ${colors.bg} ring-1 ring-black/5 sm:size-32`}
        >
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            width={256}
            height={256}
            className="h-full w-full object-cover"
          />
        </div>
        {product.tag && (
          <div className="absolute top-1.5 left-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-tighter text-brand-deep backdrop-blur-sm">
            {product.tag}
          </div>
        )}

        {/* 0 no carrinho → botão "+"; com item → stepper − / qtd / + */}
        {inCart === 0 ? (
          <button
            type="button"
            aria-label={`Adicionar ${product.name} ao carrinho`}
            onClick={handleAdd}
            className={`absolute -bottom-2 right-1 flex size-10 items-center justify-center rounded-full shadow-md transition-transform hover:scale-105 ${colors.button}`}
          >
            <Plus className="size-5" strokeWidth={2.5} />
          </button>
        ) : (
          <div className="absolute -bottom-2 right-1 flex items-center gap-1 rounded-full bg-white p-0.5 shadow-md ring-1 ring-brand-deep/10">
            <button
              type="button"
              aria-label="Remover uma unidade"
              onClick={() => updateQuantity(product.id, inCart - 1)}
              className="flex size-8 items-center justify-center rounded-full text-brand-deep transition-colors hover:bg-brand-deep/5"
            >
              <Minus className="size-4" strokeWidth={2.5} />
            </button>
            <span className="min-w-5 text-center font-display text-sm font-bold tabular-nums text-brand-deep">
              {inCart}
            </span>
            <button
              type="button"
              aria-label="Adicionar uma unidade"
              onClick={() => updateQuantity(product.id, inCart + 1)}
              className={`flex size-8 items-center justify-center rounded-full ${colors.button}`}
            >
              <Plus className="size-4" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
