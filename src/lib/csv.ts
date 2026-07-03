// Geração e download de CSV no navegador.

type Cell = string | number | null | undefined;

function escapeCell(v: Cell): string {
  const s = String(v ?? "");
  // Aspas se tiver vírgula, aspas, ponto-e-vírgula ou quebra de linha.
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(headers: string[], rows: Cell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  return lines.join("\n");
}

export function downloadCSV(filename: string, content: string): void {
  // ﻿ (BOM) para o Excel abrir com acentos corretos.
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
