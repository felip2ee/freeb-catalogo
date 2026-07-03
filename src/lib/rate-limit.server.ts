import { getRequest } from "@tanstack/react-start/server";

// Rate limit simples em memória, por IP + rota. Suficiente para um container
// único (deploy atual via Portainer); se um dia houver múltiplas réplicas,
// trocar por um contador compartilhado (Redis/Postgres).
// SÓ servidor — importar dinamicamente dentro de handlers de server function.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function clientIp(): string {
  try {
    const req = getRequest();
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
    return req.headers.get("x-real-ip") ?? "unknown";
  } catch {
    return "unknown";
  }
}

// Lança Error("rate_limited") quando o IP excede `max` chamadas na janela.
export function assertRateLimit(route: string, max: number, windowMs: number): void {
  const now = Date.now();

  // Limpeza ocasional para o Map não crescer sem limite.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (now >= b.resetAt) buckets.delete(k);
    }
  }

  const key = `${route}:${clientIp()}`;
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (bucket.count >= max) throw new Error("rate_limited");
  bucket.count += 1;
}
