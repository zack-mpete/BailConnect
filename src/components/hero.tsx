import { ArrowRight, FileSignature, Home, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui";

const highlights: Array<{ Icon: LucideIcon; label: string }> = [
  { Icon: Home, label: "Biens vérifiables" },
  { Icon: FileSignature, label: "Bail validé" },
  { Icon: ShieldCheck, label: "Traçabilité Supabase" }
];

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 py-10 md:px-6 md:py-20">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.05fr_.95fr] md:items-center">
        <div>
          <div className="mb-4 inline-flex rounded-full bg-brand-50 px-4 py-2 text-sm font-bold text-brand-700">Plateforme de location immobilière transparente</div>
          <h1 className="text-4xl font-black leading-tight tracking-tight md:text-6xl">Trouver, louer et valider un bail depuis une seule interface.</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-muted md:text-lg">BailConnect combine un fil d'actualité immobilier mobile-first, des dashboards par rôle et des contrats de bail avec accord des parties.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button href="/search" className="bg-ink text-white">Chercher une maison <ArrowRight size={17} /></Button>
            <Button href="/add-house" className="bg-white text-ink shadow-card">Publier un bien</Button>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-3 text-sm">
            {highlights.map(({ Icon, label }) => (
              <div key={label} className="rounded-2xl bg-white p-3 font-semibold shadow-card">
                <Icon className="mb-2 text-brand-600" size={20} />
                {label}
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-[2.5rem] p-4 shadow-soft">
          <img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200&auto=format&fit=crop" alt="Maison moderne" className="h-[460px] w-full rounded-[2rem] object-cover" />
        </div>
      </div>
    </section>
  );
}
