import { formatBRL } from "@/lib/products";

export interface OrderLineItem {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  size?: string | null;
}

// Lista "02× nome · tamanho ..... R$" usada nos detalhes de pedido (admin e histórico).
export function OrderItemsList({ items }: { items: OrderLineItem[] }) {
  return (
    <ul className="divide-y divide-brand-deep/10">
      {items.map((it) => (
        <li key={it.product_id} className="flex justify-between gap-3 py-2 text-sm">
          <span>
            <span className="font-mono text-xs text-brand-deep/50">
              {String(it.quantity).padStart(2, "0")}×
            </span>{" "}
            {it.name}
            {it.size && <span className="text-xs text-brand-deep/50"> · {it.size}</span>}
          </span>
          <span className="font-mono">{formatBRL(it.unit_price * it.quantity)}</span>
        </li>
      ))}
    </ul>
  );
}
