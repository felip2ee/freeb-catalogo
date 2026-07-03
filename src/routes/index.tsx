import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { Footer } from "@/components/Footer";
import { productsQueryOptions, useProducts } from "@/lib/api/products";
import { categoriesQueryOptions, useCategories } from "@/lib/api/categories";

export const Route = createFileRoute("/")({
  // Prefetch no servidor para o catálogo já vir renderizado (SSR) e hidratar
  // a partir do cache do TanStack Query.
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(productsQueryOptions),
      context.queryClient.ensureQueryData(categoriesQueryOptions),
    ]),
  head: () => ({
    meta: [
      { title: "FreeB — Catálogo de Sucos 100% Naturais" },
      {
        name: "description",
        content:
          "Catálogo online de sucos naturais: laranja, acerola, caju e maracujá em vários tamanhos (300ml, 500ml, 1L e 5L). Sabor direto do produtor.",
      },
      { property: "og:title", content: "FreeB — Catálogo de Sucos 100% Naturais" },
      {
        property: "og:description",
        content:
          "Catálogo online de sucos naturais: laranja, acerola, caju e maracujá em vários tamanhos (300ml, 500ml, 1L e 5L). Sabor direto do produtor.",
      },
    ],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const { data: products = [], isLoading, isError, refetch } = useProducts();
  const { data: categories = [] } = useCategories();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const visibleProducts = activeCategory
    ? products.filter((p) => p.category?.id === activeCategory)
    : products;

  return (
    <div className="min-h-screen bg-brand-cream font-sans text-brand-deep">
      <Header />

      <main>
        <header className="px-6 pt-16 pb-12">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-4xl">
              <h1 className="font-display text-5xl font-bold leading-tight text-balance md:text-7xl lg:text-8xl">
                A essência da fruta <br />
                <span className="italic text-accent-orange">em cada gota.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-brand-deep/80 text-pretty">
                Explore nossa linha premium de sucos 100% naturais, produzidos com frutas
                selecionadas no auge da maturação, em tamanhos de 300ml a 5L.
              </p>
            </div>
          </div>
        </header>

        <section className="px-6 pb-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 flex items-end justify-between border-b border-brand-deep/10 pb-6">
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-accent-orange">
                  Catálogo Completo
                </span>
                <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">
                  Nossas Edições
                </h2>
              </div>
              <span className="hidden text-sm text-brand-deep/60 md:block">
                {isLoading ? "Carregando..." : `${visibleProducts.length} sabores disponíveis`}
              </span>
            </div>

            {categories.length > 0 && (
              <div className="mb-8 flex flex-wrap gap-2">
                <FilterChip
                  label="Todos"
                  active={activeCategory === null}
                  onClick={() => setActiveCategory(null)}
                />
                {categories.map((c) => (
                  <FilterChip
                    key={c.id}
                    label={c.name}
                    active={activeCategory === c.id}
                    onClick={() => setActiveCategory(c.id)}
                  />
                ))}
              </div>
            )}

            {isError ? (
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-brand-deep/10 bg-white p-12 text-center">
                <p className="font-display text-xl font-bold">
                  Não foi possível carregar o catálogo
                </p>
                <p className="text-brand-deep/60">Verifique sua conexão e tente novamente.</p>
                <Button
                  onClick={() => refetch()}
                  className="rounded-full bg-accent-orange text-brand-deep hover:bg-accent-orange/90"
                >
                  Tentar novamente
                </Button>
              </div>
            ) : isLoading ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex gap-4 rounded-2xl border border-brand-deep/10 bg-white p-4"
                  >
                    <div className="flex flex-1 flex-col gap-3">
                      <div className="h-5 w-2/3 animate-pulse rounded bg-brand-deep/5" />
                      <div className="h-4 w-full animate-pulse rounded bg-brand-deep/5" />
                      <div className="mt-auto h-6 w-1/3 animate-pulse rounded bg-brand-deep/5" />
                    </div>
                    <div className="size-28 shrink-0 animate-pulse rounded-xl bg-brand-deep/5 sm:size-32" />
                  </div>
                ))}
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="rounded-2xl border border-brand-deep/10 bg-white p-12 text-center text-brand-deep/60">
                Nenhum produto neste tamanho por enquanto.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {visibleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="bg-brand-deep px-6 py-20 text-brand-cream">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="font-display text-3xl italic leading-snug md:text-4xl">
              "Direto do pomar para a sua mesa, sem conservantes, apenas a pureza da natureza."
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-brand-cream/70">
              Seja para revenda, eventos ou consumo corporativo, temos condições especiais para
              pedidos atacado. Entre em contato e leve o sabor da fruta natural para o seu negócio.
            </p>
            <Button
              size="lg"
              className="mt-8 rounded-full bg-accent-orange px-10 py-6 text-sm font-bold uppercase tracking-widest text-brand-deep transition-transform hover:scale-105"
              onClick={() =>
                (window.location.href = "mailto:contato@freeb.com.br?subject=Orçamento%20Atacado")
              }
            >
              Solicitar Orçamento Atacado
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-brand-deep bg-brand-deep text-brand-cream"
          : "border-brand-deep/15 bg-white text-brand-deep hover:border-brand-deep/40"
      }`}
    >
      {label}
    </button>
  );
}
