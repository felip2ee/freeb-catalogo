import { Leaf, Recycle, Truck } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-brand-deep/10 bg-brand-cream px-6 py-12 text-brand-deep">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-start justify-between gap-10 md:flex-row md:items-center">
          <div className="max-w-md">
            <div className="font-display text-3xl italic font-bold">FreeB</div>
            <p className="mt-3 text-sm leading-relaxed text-brand-deep/60">
              Sucos 100% naturais em garrafas de 600ml. Trabalhamos com produtores locais e
              respeitamos o ciclo da natureza. Nossas embalagens são 100% recicláveis.
            </p>
          </div>

          <div className="flex flex-wrap gap-8 text-xs font-medium uppercase tracking-widest text-brand-deep/60">
            <a href="#" className="transition-colors hover:text-brand-deep">Sustentabilidade</a>
            <a href="#" className="transition-colors hover:text-brand-deep">Logística</a>
            <a href="#" className="transition-colors hover:text-brand-deep">Privacidade</a>
            <a href="#" className="transition-colors hover:text-brand-deep">Instagram</a>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 border-t border-brand-deep/10 pt-10 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-accent-gold/20 text-brand-deep">
              <Leaf className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-brand-deep">100% Natural</div>
              <div className="text-xs text-brand-deep/60">Sem conservantes</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-accent-orange/20 text-brand-deep">
              <Recycle className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-brand-deep">Embalagem Sustentável</div>
              <div className="text-xs text-brand-deep/60">Garrafas recicláveis</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-accent-pink/20 text-brand-deep">
              <Truck className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-brand-deep">Entrega Direta</div>
              <div className="text-xs text-brand-deep/60">Do pomar para você</div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 text-[10px] uppercase tracking-widest font-medium text-brand-deep/50 md:flex-row">
          <div>© 2026 FreeB Indústria S.A.</div>
          <div className="flex gap-8">
            <a href="#" className="transition-colors hover:text-brand-deep">Termos</a>
            <a href="#" className="transition-colors hover:text-brand-deep">Contato</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
