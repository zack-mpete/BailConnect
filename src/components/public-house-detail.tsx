"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth-client";
import { canManageHouse, houseContractHref, houseManagerHref } from "@/lib/house-links";
import { loginHref, routes } from "@/lib/routes";
import { getSupabaseAccessToken } from "@/lib/supabase";
import { money } from "@/lib/utils";
import type { AppData, House } from "@/types";
import toast from "react-hot-toast";

export function PublicHouseDetail({ houseId, initialHouse }: { houseId: string; initialHouse: House | null }) {
  const { user, loading: authLoading } = useCurrentUser();
  const [house, setHouse] = useState(initialHouse);
  const [loading, setLoading] = useState(!initialHouse);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [hasContract, setHasContract] = useState(false);

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
        setHasContract(data.contracts.some(contract => contract.houseId === houseId));
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

  const ownsHouse = canManageHouse(user, house);

  async function submitRequest() {
    const token = await getSupabaseAccessToken();
    if (!token) {
      toast.error("Connexion requise.");
      return;
    }

    setRequesting(true);
    try {
      const response = await fetch("/api/rental-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ house_id: house!.id, message: requestMessage })
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Demande impossible.");
      toast.success("Demande envoyée au bailleur.");
      setRequestOpen(false);
      setRequestMessage("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Demande impossible.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[1.2fr_.8fr]">
      <Image
        src={house.image}
        alt={house.title}
        width={1200}
        height={940}
        priority
        sizes="(min-width: 1024px) 60vw, 100vw"
        className="h-[260px] w-full rounded-2xl object-cover shadow-soft min-[390px]:h-[340px] sm:h-[420px] lg:h-[470px]"
      />
      <Card className="space-y-5">
        <Badge tone={house.status === "Disponible" ? "success" : "warn"}>{house.status}</Badge>
        <h1 className="break-words text-2xl font-black sm:text-3xl">{house.title}</h1>
        <p className="flex min-w-0 items-start gap-2 text-muted"><MapPin className="mt-0.5 shrink-0" size={18}/><span className="break-words">{house.commune}, {house.city}</span></p>
        <p className="break-words text-2xl font-black text-brand-700 sm:text-3xl">{money(house.price)} <span className="text-sm text-muted">/ mois</span></p>
        <p className="break-words leading-7 text-slate-600">{house.description}</p>
        <div className="flex flex-wrap gap-2">{house.features.map(feature => <span key={feature} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold">{feature}</span>)}</div>
        <div className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-900"><b>Vision future :</b> une visite 3D sera ajoutée plus tard à partir de modèles .glb ou scans optimisés.</div>
        {user?.role === "locataire" && hasContract ? (
          <Button href={houseContractHref(house)} className="w-full bg-ink text-white">
            Ouvrir mon contrat
          </Button>
        ) : user?.role === "locataire" ? (
          <button
            type="button"
            onClick={() => setRequestOpen(true)}
            className="inline-flex w-full items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-bold text-white"
          >
            Demander à occuper ce bien
          </button>
        ) : user?.role === "admin" ? (
          <Button href={houseManagerHref(house.id)} className="w-full bg-ink text-white">
            Consulter dans le centre de contrôle
          </Button>
        ) : ownsHouse ? (
          <Button href={houseManagerHref(house.id)} className="w-full bg-ink text-white">
            Gérer ce bien
          </Button>
        ) : user ? (
          <Button href={routes.search} className="w-full bg-brand-50 text-brand-700">
            Voir les autres annonces
          </Button>
        ) : (
          <Button href={loginHref(`/houses/${house.id}`)} className="w-full bg-ink text-white">
            Se connecter pour envoyer une demande
          </Button>
        )}
      </Card>
      {requestOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="rental-request-title">
          <div className="safe-modal-panel w-full max-w-lg rounded-2xl bg-white p-4 shadow-soft sm:p-5">
            <h2 id="rental-request-title" className="text-xl font-black">Demande d’occupation</h2>
            <p className="mt-2 text-sm text-muted">{house.title}</p>
            <label className="mt-4 block text-sm font-bold">
              Message au bailleur (facultatif)
              <textarea
                autoFocus
                maxLength={1000}
                value={requestMessage}
                onChange={event => setRequestMessage(event.target.value)}
                rows={5}
                className="mt-2 form-control"
                placeholder="Présente brièvement ta demande..."
              />
            </label>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={() => setRequestOpen(false)} className="rounded-full bg-slate-100 px-4 py-3 text-sm font-bold">Annuler</button>
              <button onClick={submitRequest} disabled={requesting} className="rounded-full bg-ink px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                {requesting ? "Envoi..." : "Envoyer la demande"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
