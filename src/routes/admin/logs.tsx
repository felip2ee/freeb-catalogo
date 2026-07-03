import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { History, TriangleAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { listAuditLog, listErrorLog } from "@/lib/api/logs";

export const Route = createFileRoute("/admin/logs")({
  head: () => ({ meta: [{ title: "Logs — Admin FreeB" }] }),
  component: AdminLogs,
});

type Tab = "audit" | "errors";

const ACTION_LABEL: Record<string, string> = {
  INSERT: "Criou",
  UPDATE: "Alterou",
  DELETE: "Excluiu",
};
const ENTITY_LABEL: Record<string, string> = {
  orders: "Pedido",
  products: "Produto",
  categories: "Categoria",
};

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR");

function AdminLogs() {
  const [tab, setTab] = useState<Tab>("audit");
  const audit = useQuery({ queryKey: ["admin", "audit"], queryFn: listAuditLog });
  const errors = useQuery({ queryKey: ["admin", "errors"], queryFn: listErrorLog });

  const active = tab === "audit" ? audit : errors;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Logs</h1>
          <p className="mt-1 text-sm text-brand-deep/60">
            Auditoria de ações do painel e erros do servidor.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => active.refetch()}
          className="rounded-full border-brand-deep/20"
        >
          <RefreshCw className="size-4" />
          Atualizar
        </Button>
      </div>

      <div className="mt-6 flex gap-2">
        <TabButton active={tab === "audit"} onClick={() => setTab("audit")}>
          <History className="size-4" />
          Auditoria
        </TabButton>
        <TabButton active={tab === "errors"} onClick={() => setTab("errors")}>
          <TriangleAlert className="size-4" />
          Erros
        </TabButton>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-brand-deep/10 bg-white">
        {tab === "audit" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Quem</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.isLoading ? (
                <RowMessage colSpan={4}>Carregando...</RowMessage>
              ) : audit.isError ? (
                <RowMessage colSpan={4}>
                  Não foi possível carregar (a migration 0011 já rodou?).
                </RowMessage>
              ) : (audit.data?.length ?? 0) === 0 ? (
                <RowMessage colSpan={4}>Nenhuma ação registrada ainda.</RowMessage>
              ) : (
                audit.data!.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap text-brand-deep/60">
                      {fmt(a.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">{a.actor_email ?? "—"}</TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">
                        {ACTION_LABEL[a.action] ?? a.action}
                      </span>{" "}
                      <span className="text-sm text-brand-deep/60">
                        {ENTITY_LABEL[a.entity] ?? a.entity}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-brand-deep/70">{a.summary ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Mensagem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errors.isLoading ? (
                <RowMessage colSpan={3}>Carregando...</RowMessage>
              ) : errors.isError ? (
                <RowMessage colSpan={3}>
                  Não foi possível carregar (a migration 0011 já rodou?).
                </RowMessage>
              ) : (errors.data?.length ?? 0) === 0 ? (
                <RowMessage colSpan={3}>Nenhum erro registrado. 🎉</RowMessage>
              ) : (
                errors.data!.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-brand-deep/60">
                      {fmt(e.created_at)}
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-brand-deep/5 px-2 py-0.5 font-mono text-xs">
                        {e.source}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-brand-deep/70">
                      {e.message}
                      {e.detail && (
                        <span className="mt-0.5 block font-mono text-xs text-brand-deep/40">
                          {JSON.stringify(e.detail)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-brand-deep bg-brand-deep text-brand-cream"
          : "border-brand-deep/15 bg-white text-brand-deep hover:border-brand-deep/40"
      }`}
    >
      {children}
    </button>
  );
}

function RowMessage({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-10 text-center text-brand-deep/60">
        {children}
      </TableCell>
    </TableRow>
  );
}
