import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAdmin, useAdminSession } from "@/lib/auth";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [{ title: "Login — Admin FreeB" }],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const { isAdmin, loading: sessionLoading } = useAdminSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  // Já logado como admin → entra direto no painel.
  useEffect(() => {
    if (!sessionLoading && isAdmin) navigate({ to: "/admin" });
  }, [sessionLoading, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      await signInAdmin(email.trim(), password);
      navigate({ to: "/admin" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg === "not_admin"
          ? "Esta conta não tem acesso de administrador."
          : "E-mail ou senha inválidos.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-cream px-6 font-sans text-brand-deep">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-accent-orange/20 text-accent-orange">
            <LayoutDashboard className="size-7" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
            Painel administrativo
          </h1>
          <p className="mt-1 text-sm text-brand-deep/60">Acesso restrito à equipe.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-4 rounded-2xl border border-brand-deep/10 bg-white p-6"
        >
          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="text-xs font-semibold uppercase tracking-widest text-brand-deep/70"
            >
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-widest text-brand-deep/70"
            >
              Senha
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-brand-deep py-6 text-sm font-bold uppercase tracking-widest text-brand-cream hover:bg-brand-deep/90"
          >
            {submitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
