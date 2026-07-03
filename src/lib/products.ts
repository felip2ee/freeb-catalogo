export type Accent = "orange" | "pink" | "gold" | "purple";

// Lista canônica de accents — compartilhada entre o mapeamento de produtos e o
// formulário do admin (antes cada um mantinha a própria cópia).
export const ACCENTS: Accent[] = ["orange", "pink", "gold", "purple"];

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  volume: string;
  price: number;
  image: string;
  accent: Accent;
  tag?: string;
  category: Category | null; // tamanho (300ml, 500ml, 1L, 5L)
}

// Fallback de imagem usado quando `products.image_url` está null no banco.
// As imagens ficam em public/produtos/<sabor>-<tamanho>.svg (servidas na raiz).
// A migration 0006 também grava esses caminhos em image_url (fonte da verdade);
// este mapa é a rede de segurança p/ ids sem image_url. Caminho por (sabor, tamanho).
// Mapa de tamanho→arquivo: 300ml, 500ml, 1l→1000ml, 5l.
export const productImageFallback: Record<string, string> = {
  // Laranja
  "suco-laranja-600": "/produtos/laranja-500ml.webp", // id legado do seed (500ml)
  "suco-de-laranja-300ml": "/produtos/laranja-300ml.webp",
  "suco-de-laranja-500ml": "/produtos/laranja-500ml.webp",
  "suco-de-laranja-1l": "/produtos/laranja-1000ml.webp",
  "suco-de-laranja-5l": "/produtos/laranja-5l.webp",
  // Acerola (substitui Goiaba)
  "suco-goiaba-600": "/produtos/acerola-500ml.webp", // id legado renomeado p/ acerola
  "suco-de-acerola-300ml": "/produtos/acerola-300ml.webp",
  "suco-de-acerola-500ml": "/produtos/acerola-500ml.webp",
  "suco-de-acerola-1l": "/produtos/acerola-1000ml.webp",
  "suco-de-acerola-5l": "/produtos/acerola-5l.webp",
  // Caju
  "suco-caju-600": "/produtos/caju-500ml.webp", // id legado do seed (500ml)
  "suco-de-caju-300ml": "/produtos/caju-300ml.webp",
  "suco-de-caju-500ml": "/produtos/caju-500ml.webp",
  "suco-de-caju-1l": "/produtos/caju-1000ml.webp",
  "suco-de-caju-5l": "/produtos/caju-5l.webp",
  // Maracujá
  "suco-maracuja-600": "/produtos/maracuja-500ml.webp", // id legado do seed (500ml)
  "suco-de-maracuja-300ml": "/produtos/maracuja-300ml.webp",
  "suco-de-maracuja-500ml": "/produtos/maracuja-500ml.webp",
  "suco-de-maracuja-1l": "/produtos/maracuja-1000ml.webp",
  "suco-de-maracuja-5l": "/produtos/maracuja-5l.webp",
};

export const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
