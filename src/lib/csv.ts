// Geração e download de CSV no navegador.

type Cell = string | number | null | undefined;

function escapeCell(v: Cell): string {
  let s = String(v ?? "");
  // 🔒 Anti fórmula-injection: célula começando com = + - @ (ou tab/CR) viraria
  // fórmula ativa no Excel — e o nome do cliente é controlado por quem compra.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  // Aspas se tiver vírgula, aspas, ponto-e-vírgula ou quebra de linha.
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(headers: string[], rows: Cell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  return lines.join("\n");
}

export function downloadCSV(filename: string, content: string): void {
  // BOM para o Excel abrir com acentos corretos.
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
