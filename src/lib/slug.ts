// Gera um slug seguro (sem acentos, espaços ou símbolos) para usar como id.
// Ex.: "Suco de Maracujá" -> "suco-de-maracuja".
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // remove acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // não-alfanumérico vira hífen
    .replace(/^-+|-+$/g, ""); // tira hífens das pontas
}
