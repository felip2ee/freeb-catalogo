import { Leaf, Recycle, Truck } from "lucide-react";
import { useSettings } from "@/lib/api/settings";

// Normaliza o Instagram (aceita @handle, handle ou URL completa) para uma URL.
function instagramUrl(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (v.startsWith("http")) return v;
  return `https://instagram.com/${v.replace(/^@/, "")}`;
}

// WhatsApp: espera só dígitos (com DDI). Vira link wa.me.
function whatsappUrl(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? `https://wa.me/${digits}` : null;
}

export function Footer() {
  const { settings } = useSettings();
  const ig = instagramUrl(settings.instagram);
  const wa = whatsappUrl(settings.whatsapp);
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-brand-deep/10 bg-brand-cream px-6 py-12 text-brand-deep">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-start justify-between gap-10 md:flex-row md:items-center">
          <div className="max-w-md">
            <div className="font-display text-3xl italic font-bold">{settings.store_name}</div>
            <p className="mt-3 text-sm leading-relaxed text-brand-deep/60">
              {settings.store_description}
            </p>
          </div>

          <div className="flex flex-wrap gap-8 text-xs font-medium uppercase tracking-widest text-brand-deep/60">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-brand-deep"
              >
                WhatsApp
              </a>
            )}
            {settings.pickup_address && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(settings.pickup_address)}`}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-brand-deep"
              >
                Como chegar
              </a>
            )}
            {ig && (
              <a
                href={ig}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-brand-deep"
              >
                Instagram
              </a>
            )}
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
              <div className="text-sm font-semibold text-brand-deep">Retirada no Local</div>
              <div className="text-xs text-brand-deep/60">Direto do produtor</div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 text-[10px] uppercase tracking-widest font-medium text-brand-deep/50 md:flex-row">
          <div>
            © {year} {settings.store_name}
          </div>
          <div className="flex gap-8">
            {settings.contact_email && (
              <a
                href={`mailto:${settings.contact_email}`}
                className="transition-colors hover:text-brand-deep"
              >
                Contato
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
