// Mapeamento único de status do Mercado Pago → status do pedido.
// Compartilhado entre processCheckout e o webhook para os dois nunca divergirem.
//
// Retorna null para status que NÃO devem mexer no pedido (ex.: in_mediation,
// status novos/desconhecidos) — antes qualquer status desconhecido caía em
// "pending" e regredia pedidos pagos/entregues.

export type OrderPaymentStatus = "paid" | "canceled" | "pending";

export function mapMpStatus(status: string | null | undefined): OrderPaymentStatus | null {
  switch (status) {
    case "approved":
      return "paid";
    case "rejected":
    case "cancelled":
    case "refunded":
    case "charged_back":
      return "canceled";
    case "pending":
    case "in_process":
    case "authorized":
      return "pending";
    default:
      return null;
  }
}
