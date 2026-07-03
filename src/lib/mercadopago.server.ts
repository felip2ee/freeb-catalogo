import { MercadoPagoConfig, Payment } from "mercadopago";

// Cliente Mercado Pago — SÓ servidor. Usa o Access Token (segredo, sem VITE_).
// NUNCA importar no cliente. Use apenas dentro de server functions / server routes.
const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

if (!accessToken) {
  throw new Error(
    "Mercado Pago não configurado: defina MERCADOPAGO_ACCESS_TOKEN no .env (servidor).",
  );
}

export const mpClient = new MercadoPagoConfig({ accessToken });
export const mpPayment = new Payment(mpClient);
