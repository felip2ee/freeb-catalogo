import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Store, KeyRound, Check, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  settingsQueryOptions,
  saveSettings,
  getCredentialStatus,
  DEFAULT_SETTINGS,
  type StoreSettings,
} from "@/lib/api/settings";

export const Route = createFileRoute("/admin/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Admin FreeB" }] }),
  component: AdminConfiguracoes,
});

const FIELDS: { key: keyof StoreSettings; label: string; placeholder?: string; area?: boolean }[] =
  [
    { key: "store_name", label: "Nome da loja", placeholder: "FreeB" },
    {
      key: "store_description",
      label: "Descrição (rodapé)",
      placeholder: "Sucos 100% naturais...",
      area: true,
    },
    { key: "whatsapp", label: "WhatsApp", placeholder: "5511999999999 (só números, com DDI)" },
    { key: "instagram", label: "Instagram (URL ou @)", placeholder: "@freebsucos" },
    { key: "contact_email", label: "E-mail de contato", placeholder: "contato@freebsucos.com" },
    { key: "pickup_address", label: "Endereço de retirada", placeholder: "Rua ..., nº ..." },
  ];

function AdminConfiguracoes() {
  const qc = useQueryClient();
  const settings = useQuery(settingsQueryOptions);
  const credentials = useQuery({
    queryKey: ["admin", "credentials"],
    queryFn: () => getCredentialStatus(),
  });

  const [form, setForm] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);

  // Preenche o formulário quando as settings carregam.
  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(form);
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Configurações salvas");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error("Não foi possível salvar", {
        description: msg.includes("row-level security")
          ? "Sem permissão (RLS). Confirme que a migration 0011 rodou."
          : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl font-bold tracking-tight">Configurações</h1>
      <p className="mt-1 text-sm text-brand-deep/60">
        Dados da loja exibidos no site e status das credenciais do servidor.
      </p>

      {/* ── Dados da loja ── */}
      <section className="mt-6 rounded-2xl border border-brand-deep/10 bg-white p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Store className="size-5 text-accent-orange" />
          Dados da loja
        </h2>

        <div className="mt-5 grid gap-4">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-widest text-brand-deep/70">
                {f.label}
              </Label>
              {f.area ? (
                <Textarea
                  value={form[f.key]}
                  placeholder={f.placeholder}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  rows={3}
                />
              ) : (
                <Input
                  value={form[f.key]}
                  placeholder={f.placeholder}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving || settings.isLoading}
            className="rounded-full bg-brand-deep text-brand-cream hover:bg-brand-deep/90"
          >
            {saving ? "Salvando..." : "Salvar configurações"}
          </Button>
        </div>
      </section>

      {/* ── Credenciais (status, nunca o valor) ── */}
      <section className="mt-6 rounded-2xl border border-brand-deep/10 bg-white p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <KeyRound className="size-5 text-accent-orange" />
          Credenciais do servidor
        </h2>
        <p className="mt-1 flex items-start gap-2 text-sm text-brand-deep/60">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent-gold" />
          Os segredos ficam no <code className="rounded bg-brand-deep/5 px-1">.env</code> /
          Portainer e nunca são exibidos aqui — só o status de configuração.
        </p>

        <ul className="mt-5 divide-y divide-brand-deep/10">
          {credentials.isLoading ? (
            <li className="py-4 text-sm text-brand-deep/60">Verificando...</li>
          ) : (
            (credentials.data ?? []).map((c) => (
              <li key={c.key} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="font-mono text-xs text-brand-deep/50">
                    {c.key} · {c.scope}
                    {c.note ? ` · ${c.note}` : ""}
                  </p>
                </div>
                {c.configured ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-800">
                    <Check className="size-3.5" />
                    Configurado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-xs font-medium text-red-900">
                    <X className="size-3.5" />
                    Faltando
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
