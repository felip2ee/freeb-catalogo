import { useMemo } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { type Accent, type Product, productImageFallback } from "@/lib/products";

// Formato cru de uma linha da tabela `products` no Supabase.
interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  volume: string | null;
  price: number | string; // numeric do Postgres pode chegar como string
  image_url: string | null;
  accent: string | null;
  tag: string | null;
  // join aninhado: supabase-js tipa embeds como array; normalizamos em mapRow.
  category: { id: string; name: string } | { id: string; name: string }[] | null;
}

const ACCENTS: Accent[] = ["orange", "pink", "gold", "purple"];

// Converte uma linha do banco no tipo Product usado pela UI.
// `image_url` do banco tem prioridade; cai no fallback local enquanto for null.
function mapRow(row: ProductRow): Product {
  const accent = ACCENTS.includes(row.accent as Accent) ? (row.accent as Accent) : "orange";

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    volume: row.volume ?? "",
    price: Number(row.price),
    image: row.image_url ?? productImageFallback[row.id] ?? "",
    accent,
    tag: row.tag ?? undefined,
    category: normalizeCategory(row.category),
  };
}

// O embed pode chegar como objeto (to-one) ou array (tipagem do supabase-js).
function normalizeCategory(raw: ProductRow["category"]): { id: string; name: string } | null {
  const cat = Array.isArray(raw) ? raw[0] : raw;
  return cat ? { id: cat.id, name: cat.name } : null;
}

// Busca os produtos ativos (RLS garante que anon só enxerga active = true).
export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,description,volume,price,image_url,accent,tag,category:categories(id,name)")
    .eq("active", true)
    .order("price", { ascending: true });

  if (error) throw error;
  return (data as unknown as ProductRow[]).map(mapRow);
}

// Opções compartilhadas: usadas pelo hook e por loaders/prefetch de rota.
export const productsQueryOptions = queryOptions({
  queryKey: ["products"],
  queryFn: fetchProducts,
  staleTime: 5 * 60 * 1000, // catálogo muda pouco; evita refetch a cada navegação
});

// Lista de produtos ativos.
export function useProducts() {
  return useQuery(productsQueryOptions);
}

// Igual ao useProducts, mas também expõe um Map id -> Product para resolver
// itens do carrinho (que guardam só productId) sem varrer o array toda hora.
export function useProductMap() {
  const query = useProducts();
  const map = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of query.data ?? []) m.set(p.id, p);
    return m;
  }, [query.data]);
  return { ...query, map };
}
