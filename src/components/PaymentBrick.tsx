import { useEffect, useState, type ComponentType } from "react";

// Dados que o Brick devolve no onSubmit.
export interface BrickSubmit {
  selectedPaymentMethod: string;
  formData: Record<string, unknown>;
}

interface PaymentBrickProps {
  amount: number;
  payerEmail?: string;
  onSubmit: (data: BrickSubmit) => Promise<void>;
}

// O SDK do Mercado Pago acessa `window`, então carregamos só no cliente
// (import dinâmico dentro do useEffect) para não quebrar o SSR.
export function PaymentBrick({ amount, payerEmail, onSubmit }: PaymentBrickProps) {
  const [Brick, setBrick] = useState<ComponentType<Record<string, unknown>> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    import("@mercadopago/sdk-react")
      .then((mod) => {
        const pk = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY;
        if (!pk) {
          setError(true);
          return;
        }
        mod.initMercadoPago(pk, { locale: "pt-BR" });
        if (active) {
          setBrick(() => mod.Payment as unknown as ComponentType<Record<string, unknown>>);
        }
      })
      .catch(() => setError(true));
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Pagamento indisponível: chave pública do Mercado Pago não configurada.
      </p>
    );
  }

  if (!Brick) {
    return <p className="text-sm text-brand-deep/60">Carregando pagamento...</p>;
  }

  return (
    <Brick
      initialization={{ amount, payer: payerEmail ? { email: payerEmail } : undefined }}
      customization={{
        paymentMethods: {
          creditCard: "all",
          debitCard: "all",
          bankTransfer: "all", // Pix
        },
      }}
      onSubmit={onSubmit}
    />
  );
}
