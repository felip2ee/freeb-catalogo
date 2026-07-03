import { Minus, Plus } from "lucide-react";

interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
}

export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 99,
  size = "md",
}: QuantitySelectorProps) {
  const buttonClass = size === "sm" ? "h-8 w-8 text-brand-deep" : "h-10 w-10 text-brand-deep";
  const valueClass = size === "sm" ? "w-8 text-sm" : "w-10 text-base";

  return (
    <div className="inline-flex items-center rounded-full border border-brand-deep/15 bg-white">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Diminuir quantidade"
        className={`${buttonClass} flex items-center justify-center rounded-l-full transition hover:bg-brand-deep/5 disabled:opacity-40`}
      >
        <Minus className="size-4" />
      </button>
      <span className={`${valueClass} text-center font-semibold tabular-nums text-brand-deep`}>
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Aumentar quantidade"
        className={`${buttonClass} flex items-center justify-center rounded-r-full transition hover:bg-brand-deep/5 disabled:opacity-40`}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
