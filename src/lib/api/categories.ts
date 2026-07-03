import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/lib/products";

interface CategoryRow {
  id: string;
  name: string;
  sort_order: number;
}

// Categorias ativas (tamanhos), ordenadas para os filtros da loja.
export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data as CategoryRow[]).map((c) => ({ id: c.id, name: c.name }));
}

export const categoriesQueryOptions = queryOptions({
  queryKey: ["categories"],
  queryFn: fetchCategories,
  staleTime: 5 * 60 * 1000,
});

export function useCategories() {
  return useQuery(categoriesQueryOptions);
}
