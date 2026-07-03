import { useEffect, useRef } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut, LayoutDashboard, Package, Ruler, ShoppingBag, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminSession, signOutAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { formatBRL } from "@/lib/products";
import { playNewOrderSound } from "@/lib/notify-sound";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const NAV = [
  { label: "Dashboard", to: "/admin" as const, icon: LayoutDashboard, exact: true },
  { label: "Pedidos", to: "/admin/pedidos" as const, icon: ShoppingBag, exact: false },
  { label: "Clientes", to: "/admin/clientes" as const, icon: Users, exact: false },
  { label: "Produtos", to: "/admin/produtos" as const, icon: Package, exact: false },
  { label: "Categorias", to: "/admin/categorias" as const, icon: Ruler, exact: false },
];

function AdminLayout() {
  const { loading, isAdmin, email } = useAdminSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLoginPage = pathname === "/admin/login";

  const qc = useQueryClient();
  const notified = useRef<Set<string>>(new Set());

  // Guard: sem sessão de admin (e fora da tela de login) → manda para o login.
  useEffect(() => {
    if (!loading && !isAdmin && !isLoginPage) {
      navigate({ to: "/admin/login" });
    }
  }, [loading, isAdmin, isLoginPage, navigate]);

  // Realtime: novo pedido pago → som + popup (em qualquer tela do admin).
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-notify")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        qc.invalidateQueries({ queryKey: ["admin", "orders"] });
        qc.invalidateQueries({ queryKey: ["admin", "customers"] });

        const row = payload.new as {
          id?: string;
          code?: string;
          total?: number | string;
          status?: string;
        };
        if (row?.status === "paid" && row.id && !notified.current.has(row.id)) {
          notified.current.add(row.id);
          playNewOrderSound();
          toast.success("Novo pedido pago! 🎉", {
            description: `${row.code ?? ""} · ${formatBRL(Number(row.total ?? 0))}`,
            duration: 8000,
          });
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, qc]);

  if (isLoginPage) return <Outlet />;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-cream text-brand-deep">
        <p className="text-brand-deep/60">Carregando painel...</p>
      </div>
    );
  }

  if (!isAdmin) return null; // redirecionando para o login

  return (
    <div className="flex min-h-screen bg-brand-cream font-sans text-brand-deep">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-brand-deep/10 bg-white md:flex">
        <div className="flex items-center gap-2 border-b border-brand-deep/10 px-5 py-5">
          <LayoutDashboard className="size-5 text-accent-orange" />
          <span className="font-display text-lg font-bold tracking-tight">
            FreeB <span className="text-brand-deep/50">Admin</span>
          </span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              activeProps={{ className: "bg-brand-deep text-brand-cream hover:bg-brand-deep" }}
              inactiveProps={{ className: "text-brand-deep/80 hover:bg-brand-deep/5" }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-brand-deep/10 p-3">
          {email && <p className="px-3 pb-2 text-xs text-brand-deep/50 break-all">{email}</p>}
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await signOutAdmin();
              navigate({ to: "/admin/login" });
            }}
            className="w-full rounded-lg border-brand-deep/20"
          >
            <LogOut className="size-4" />
            Sair
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar (mobile nav) */}
        <header className="flex items-center justify-between gap-4 border-b border-brand-deep/10 bg-white px-5 py-3 md:hidden">
          <span className="font-display text-lg font-bold">FreeB Admin</span>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await signOutAdmin();
              navigate({ to: "/admin/login" });
            }}
            className="rounded-lg border-brand-deep/20"
          >
            <LogOut className="size-4" />
          </Button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-brand-deep/10 bg-white px-3 py-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              activeProps={{ className: "bg-brand-deep text-brand-cream" }}
              inactiveProps={{ className: "text-brand-deep/80" }}
              className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 px-5 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
