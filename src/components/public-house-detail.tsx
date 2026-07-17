"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth-client";
import { houseContractHref, houseContractsHref } from "@/lib/house-links";
import { loginHref, routes } from "@/lib/routes";
import { getSupabaseAccessToken } from "@/lib/supabase";
import { money } from "@/lib/utils";
import type { AppData, House } from "@/types";

export function PublicHouseDetail({ houseId, initialHouse }: { houseId: string; initialHouse: House | null }) {
  const { user, loading: authLoading } = useCurrentUser();
  const [house, setHouse] = useState(initialHouse);
  const [loading, setLoading] = useState(!initialHouse);

  useEffect(() => {
    setHouse(initialHouse);
    setLoading(!initialHouse);
  }, [initialHouse]);

  useEffect(() => {
    async function loadAccessibleHouse() {
      if (initialHouse) return;
      if (authLoading) return;
      if (!user) {
        setLoading(false);
        return;
      }

      const token = await getSupabaseAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/dashboard", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store"
        });
        if (!response.ok) return;

        const data = (await response.json()) as AppData;
        setHouse(data.houses.find(item => item.id === houseId) || null);
      } finally {
        setLoading(false);
      }
    }

    loadAccessibleHouse();
  }, [authLoading, houseId, initialHouse, user]);

  if (loading || authLoading) {
    return <Card><p className="font-semibold text-muted">Chargement du bien...</p></Card>;
  }

  if (!house) {
    return (
      <Card className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-black">Bien introuvable ou indisponible</h1>
        <p className="text-muted">L’annonce a peut-être été retirée, ou ce compte n’a pas accès à ce bien.</p>
        <div className="flex flex-wrap gap-2">
          <Button href={routes.search} className="bg-ink text-white">Voir les annonces</Button>
          {!user && <Button href={loginHref(`/houses/${houseId}`)} className="bg-brand-50 text-brand-700">Se connecter</Button>}
        </div>
      </Card>
    );
  }

  const contractHref = user
    ? houseContractHref(house, user)
    : loginHref(houseContractsHref(house.id));

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
      <Image
        src={house.image}
        alt={house.title}
        width={1200}
        height={940}
        priority
        sizes="(min-width: 1024px) 60vw, 100vw"
        className="h-[470px] w-full rounded-2xl object-cover shadow-soft"
      />
      <Card className="space-y-5">
        <Badge tone={house.status === "Disponible" ? "success" : "warn"}>{house.status}</Badge>
        <h1 className="text-3xl font-black">{house.title}</h1>
        <p className="flex items-center gap-2 text-muted"><MapPin size={18}/>{house.commune}, {house.city}</p>
        <p className="text-3xl font-black text-brand-700">{money(house.price)} <span className="text-sm text-muted">/ mois</span></p>
        <p className="leading-7 text-slate-600">{house.description}</p>
        <div className="flex flex-wrap gap-2">{house.features.map(feature => <span key={feature} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold">{feature}</span>)}</div>
        <div className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-900"><b>Vision future :</b> une visite 3D sera ajoutée plus tard à partir de modèles .glb ou scans optimisés.</div>
        <Button href={contractHref} className="w-full bg-ink text-white">{user ? "Ouvrir le contrat" : "Se connecter pour contacter"}</Button>
      </Card>
    </div>
  );
}
