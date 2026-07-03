// Status de pedido — rótulos e cores compartilhados entre admin e loja.

export const ORDER_STATUSES = ["pending", "paid", "preparing", "delivered", "canceled"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_META: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-accent-gold/20 text-brand-deep" },
  paid: { label: "Pago", className: "bg-accent-orange/20 text-brand-deep" },
  preparing: { label: "Preparando", className: "bg-accent-purple/20 text-brand-deep" },
  delivered: { label: "Entregue", className: "bg-emerald-500/20 text-emerald-900" },
  canceled: { label: "Cancelado", className: "bg-red-500/15 text-red-900" },
};

export function statusMeta(status: string) {
  return (
    STATUS_META[status as OrderStatus] ?? {
      label: status,
      className: "bg-brand-deep/10 text-brand-deep",
    }
  );
}
