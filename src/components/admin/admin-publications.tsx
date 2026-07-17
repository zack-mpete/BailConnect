"use client";

import Link from "next/link";
import { Archive, CheckCircle2, Eye, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui";
import { houseManagerHref } from "@/lib/house-links";
import { money } from "@/lib/utils";
import type { House } from "@/types";

type PublicationAction = "archive" | "restore" | "validate" | "delete";

export function AdminPublications({ houses, onAction }: { houses: House[]; onAction: (house: House, action: PublicationAction) => void }) {
  return (
    <div className="space-y-3">
      <div className="surface-card">
        <h2 className="text-xl font-black">Gestion des publications</h2>
        <p className="mt-1 text-sm text-muted">Modération, archivage et suppression des annonces publiées.</p>
      </div>
      <div className="grid max-h-[calc(100vh-220px)] gap-3 overflow-y-auto pr-1 scrollbar-soft">
        {houses.map(house => {
          const archived = house.status === "Archivé";
          const validated = house.status === "Disponible";
          return (
            <div key={house.id} className="surface-card">
              <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={houseManagerHref(house.id)} className="min-w-0 truncate text-lg font-black hover:text-brand-700">{house.title}</Link>
                    <Badge tone={house.status === "Disponible" ? "success" : "warn"}>{house.status}</Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted">{house.commune}, {house.city} - {house.owner}</p>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-700">{house.description}</p>
                  <details className="mt-3">
                    <summary className="inline-flex cursor-pointer items-center gap-1 text-sm font-bold text-brand-700"><Eye size={15} /> Détails publication</summary>
                    <div className="mt-2 grid gap-2 soft-tile text-sm md:grid-cols-3">
                      <p>Type : <strong>{house.type}</strong></p>
                      <p>Pièces : <strong>{house.rooms}</strong></p>
                      <p>Loyer : <strong>{money(house.price)}</strong></p>
                      <p>Occupant : <strong>{house.currentTenant || "Aucun"}</strong></p>
                      <p>Contrat courant : <strong>{house.currentContractId || "Aucun"}</strong></p>
                      <p className="md:col-span-3">ID : {house.id}</p>
                    </div>
                  </details>
                </div>
                <div className="grid content-start gap-2">
                  <Link href={houseManagerHref(house.id)} className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
                    Ouvrir detail
                  </Link>
                  <button onClick={() => onAction(house, "validate")} disabled={validated} className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                    <CheckCircle2 size={16} />
                    {validated ? "Validée" : "Valider"}
                  </button>
                  <button onClick={() => onAction(house, archived ? "restore" : "archive")} className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-sm font-bold text-brand-700">
                    {archived ? <RotateCcw size={16} /> : <Archive size={16} />}
                    {archived ? "Restaurer" : "Archiver"}
                  </button>
                  <button onClick={() => onAction(house, "delete")} className="inline-flex items-center justify-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-bold text-red-700">
                    <Trash2 size={16} /> Supprimer
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
