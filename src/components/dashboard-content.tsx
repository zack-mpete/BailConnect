"use client";

import { Card, Badge } from "@/components/ui";
import { Building2, FileSignature, Users } from "lucide-react";
import { useCurrentUser } from "@/lib/auth-client";
import type { AppData } from "@/types";

export function DashboardContent({ data }: { data: AppData }) {
  const { user } = useCurrentUser();
  if (user?.role === "admin") return null;

  const allCards = [
    ["Maisons", data.stats.houses, Building2],
    ["Contrats", data.stats.contracts, FileSignature],
    ["Utilisateurs", data.stats.users, Users]
  ] as const;

  const cards = allCards.filter(([label]) => {
    if (user?.role === "bailleur" || user?.role === "agence") return label !== "Utilisateurs";
    return label === "Contrats";
  });
  const showListings = user?.role === "bailleur" || user?.role === "agence";

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-4">{cards.map(([label, value, Icon]) => <Card key={label}><Icon className="text-brand-600"/><p className="mt-4 text-3xl font-black">{value}</p><p className="text-sm font-semibold text-muted">{label}</p></Card>)}</div>
      <div className="grid gap-5 lg:grid-cols-2">
        {showListings && <Card>
          <h2 className="text-xl font-black">Annonces récentes</h2>
          <div className="mt-4 space-y-3">{data.houses.map(h => <div key={h.id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3"><div><p className="font-bold">{h.title}</p><p className="text-sm text-muted">{h.commune} - {h.owner}</p></div><Badge tone={h.status === "Disponible" ? "success" : "warn"}>{h.status}</Badge></div>)}</div>
        </Card>}
        <Card>
          <h2 className="text-xl font-black">Contrats</h2>
          <div className="mt-4 space-y-3">{data.contracts.map(c => <div key={c.id} className="rounded-2xl bg-slate-50 p-4"><p className="font-bold">{c.tenant} / {c.owner}</p><p className="text-sm text-muted">Début: {c.startDate} - Durée: {c.duration}</p><Badge>{c.status}</Badge></div>)}</div>
        </Card>
      </div>
    </div>
  );
}
