import { Link } from "@tanstack/react-router";
import { Menu, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/contexts/CartContext";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { totalItems } = useCart();

  const navLinks = [
    { label: "Catálogo", to: "/" as const },
    { label: "Meus pedidos", to: "/meus-pedidos" as const },
    { label: "Carrinho", to: "/carrinho" as const },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-brand-deep/10 bg-brand-cream/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link
          to="/"
          className="font-display text-2xl italic font-bold tracking-tight text-brand-deep"
        >
          FreeB
        </Link>

        <div className="hidden items-center gap-8 text-sm font-medium uppercase tracking-widest text-brand-deep md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              activeProps={{ className: "border-b-2 border-brand-deep pb-0.5" }}
              activeOptions={{ exact: true }}
              className="transition-colors hover:text-accent-orange"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/carrinho"
            aria-label="Abrir carrinho"
            className="relative inline-flex items-center justify-center rounded-full p-2 text-brand-deep transition hover:bg-brand-deep/5"
          >
            <ShoppingBag className="size-5" />
            {totalItems > 0 && (
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-orange px-1 text-[10px] font-bold text-brand-deep">
                {totalItems}
              </span>
            )}
          </Link>

          <button
            className="p-2 text-brand-deep md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          >
            {mobileOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-brand-deep/10 bg-brand-cream px-6 py-4 md:hidden">
          <div className="flex flex-col gap-4 text-sm font-medium uppercase tracking-widest text-brand-deep">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className="transition-colors hover:text-accent-orange"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
