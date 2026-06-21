"use client";

import { BedDouble, MapPin, ShieldCheck } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth-client";
import { money } from "@/lib/utils";
import type { House } from "@/types";

export function HouseCard({ house }: { house: House }) {
  const { user } = useCurrentUser();
  const tone = house.status === "Disponible" ? "success" : house.status === "Réservé" ? "warn" : "default";

  return (
    <article className="animate-[fadeIn_.28s_ease-out]">
      <Card className="overflow-hidden p-0">
        <div className="relative h-56 overflow-hidden rounded-t-xxl">
          <img src={house.image} alt={house.title} className="h-full w-full object-cover transition duration-700 hover:scale-105" />
          <div className="absolute left-4 top-4"><Badge tone={tone}>{house.status}</Badge></div>
          <div className="absolute bottom-4 right-4 rounded-full bg-white/90 px-4 py-2 text-sm font-black shadow-card">{money(house.price)} / mois</div>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <h3 className="text-lg font-black">{house.title}</h3>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted"><MapPin size={16} />{house.commune}, {house.city}</p>
          </div>
          <p className="text-sm leading-6 text-slate-600">{house.description}</p>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-2"><BedDouble size={15} />{house.rooms} pièces</span>
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-2"><ShieldCheck size={15} />{house.owner}</span>
          </div>
          <div className="flex gap-2">
            <Button href={`/houses/${house.id}`} className="flex-1 bg-ink text-white">Voir détails</Button>
            <Button href={user ? `/contrats?house=${house.id}` : "/auth"} className="bg-brand-50 text-brand-700">{user ? "Contrat" : "Se connecter"}</Button>
          </div>
        </div>
      </Card>
    </article>
  );
}
