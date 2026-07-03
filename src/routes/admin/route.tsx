import { useEffect, useRef } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LogOut,
  LayoutDashboard,
  Package,
  Ruler,
  ShoppingBag,
  Users,
  Settings,
  ScrollText,
  Truck,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminSession, signOutAdmin, type PanelRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { formatBRL } from "@/lib/products";
import { playNewOrderSound } from "@/lib/notify-sound";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
  exact: boolean;
}

// Nav do admin (acesso total).
const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Pedidos", to: "/admin/pedidos", icon: ShoppingBag, exact: false },
  { label: "Clientes", to: "/admin/clientes", icon: Users, exact: false },
  { label: "Produtos", to: "/admin/produtos", icon: Package, exact: false },
  { label: "Categorias", to: "/admin/categorias", icon: Ruler, exact: false },
  { label: "Funcionários", to: "/admin/funcionarios", icon: UserCog, exact: false },
  { label: "Logs", to: "/admin/logs", icon: ScrollText, exact: false },
  { label: "Configurações", to: "/admin/configuracoes", icon: Settings, exact: false },
];

// Nav do staff (entregador): só a tela do dia.
const STAFF_NAV: NavItem[] = [{ label: "Do dia", to: "/admin/do-dia", icon: Truck, exact: false }];

const navForRole = (role: PanelRole): NavItem[] =>
  role === "admin" ? ADMIN_NAV : role === "staff" ? STAFF_NAV : [];

function AdminLayout() {
  const { loading, role, isAdmin, email } = useAdminSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLoginPage = pathname === "/admin/login";

  const qc = useQueryClient();
  const notified = useRef<Set<string>>(new Set());
  const invalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nav = navForRole(role);

  // Guard por papel: sem papel → login; staff fora da tela "Do dia" → redireciona.
  useEffect(() => {
    if (loading || isLoginPage) return;
    if (!role) {
      navigate({ to: "/admin/login" });
      return;
    }
    if (role === "staff" && !pathname.startsWith("/admin/do-dia")) {
      navigate({ to: "/admin/do-dia" });
    }
  }, [loading, role, isLoginPage, pathname, navigate]);

  // Realtime: novo pedido pago → som + popup (admin e staff recebem).
  useEffect(() => {
    if (!role) return;
    const channel = supabase
      .channel("admin-notify")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        // Debounce: uma rajada de eventos vira um único refetch da lista
        // (clientes derivam do mesmo cache — ver customerStatsFromOrders).
        if (invalidateTimer.current) clearTimeout(invalidateTimer.current);
        invalidateTimer.current = setTimeout(() => {
          qc.invalidateQueries({ queryKey: ["admin", "orders"] });
        }, 400);

        // Evita crescer sem limite numa sessão longa do painel.
        if (notified.current.size > 500) notified.current.clear();

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
      if (invalidateTimer.current) clearTimeout(invalidateTimer.current);
      supabase.removeChannel(channel);
    };
  }, [role, qc]);

  if (isLoginPage) return <Outlet />;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-cream text-brand-deep">
        <p className="text-brand-deep/60">Carregando painel...</p>
      </div>
    );
  }

  if (!role) return null; // redirecionando para o login

  return (
    <div className="flex min-h-screen bg-brand-cream font-sans text-brand-deep">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-brand-deep/10 bg-white md:flex">
        <div className="flex items-center gap-2 border-b border-brand-deep/10 px-5 py-5">
          <LayoutDashboard className="size-5 text-accent-orange" />
          <span className="font-display text-lg font-bold tracking-tight">
            FreeB <span className="text-brand-deep/50">{isAdmin ? "Admin" : "Entregas"}</span>
          </span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => (
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
          <LogoutButton className="w-full rounded-lg border-brand-deep/20" label="Sair" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar (mobile nav) */}
        <header className="flex items-center justify-between gap-4 border-b border-brand-deep/10 bg-white px-5 py-3 md:hidden">
          <span className="font-display text-lg font-bold">
            FreeB {isAdmin ? "Admin" : "Entregas"}
          </span>
          <LogoutButton className="rounded-lg border-brand-deep/20" />
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-brand-deep/10 bg-white px-3 py-2 md:hidden">
          {nav.map((item) => (
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

function LogoutButton({ className, label }: { className?: string; label?: string }) {
  const navigate = useNavigate();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await signOutAdmin();
        navigate({ to: "/admin/login" });
      }}
      className={className}
    >
      <LogOut className="size-4" />
      {label}
    </Button>
  );
}
