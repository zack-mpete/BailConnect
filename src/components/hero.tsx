import { ArrowRight, FileSignature, Home, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui";

const highlights: Array<{ Icon: LucideIcon; label: string }> = [
  { Icon: Home, label: "Biens vérifiables" },
  { Icon: FileSignature, label: "Bail validé" },
  { Icon: ShieldCheck, label: "Traçabilité Supabase" }
];

export function Hero() {
  return (
    <section className="relative overflow-hidden px-3 py-8 min-[360px]:px-4 md:px-6 md:py-20">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.05fr_.95fr] md:items-center">
        <div>
          <div className="mb-4 inline-flex max-w-full rounded-full bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700 min-[360px]:px-4 min-[360px]:text-sm">Plateforme de location immobilière transparente</div>
          <h1 className="break-words text-3xl font-black leading-tight tracking-tight min-[390px]:text-4xl md:text-6xl">Trouver, louer et valider un bail depuis une seule interface.</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-muted md:text-lg">BailConnect combine un fil d'actualité immobilier mobile-first, des dashboards par rôle et des contrats de bail avec accord des parties.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button href="/search" className="w-full bg-ink text-white sm:w-auto">Chercher une maison <ArrowRight size={17} /></Button>
            <Button href="/dashboard?section=properties" className="w-full bg-white text-ink shadow-card sm:w-auto">Gerer mes biens</Button>
          </div>
          <div className="mt-8 grid gap-3 text-sm min-[520px]:grid-cols-3">
            {highlights.map(({ Icon, label }) => (
              <div key={label} className="rounded-2xl bg-white p-3 font-semibold shadow-card">
                <Icon className="mb-2 text-brand-600" size={20} />
                {label}
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-2xl p-4 shadow-soft">
          <Image
            src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200&auto=format&fit=crop"
            alt="Maison moderne"
            width={1200}
            height={920}
            priority
            sizes="(min-width: 768px) 47vw, 100vw"
            className="h-[260px] w-full rounded-2xl object-cover min-[390px]:h-[320px] md:h-[460px]"
          />
        </div>
      </div>
    </section>
  );
}
