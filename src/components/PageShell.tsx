import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

// Layout padrão das páginas públicas (Header + main + Footer sobre brand-cream).
export function PageShell({
  children,
  mainClassName = "mx-auto max-w-5xl px-6 py-16",
}: {
  children: React.ReactNode;
  mainClassName?: string;
}) {
  return (
    <div className="min-h-screen bg-brand-cream font-sans text-brand-deep">
      <Header />
      <main className={mainClassName}>{children}</main>
      <Footer />
    </div>
  );
}
