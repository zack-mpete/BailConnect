"use client";

import { Archive, Eye, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui";
import { money } from "@/lib/utils";
import type { House } from "@/types";

export function AdminPublications({ houses, onAction }: { houses: House[]; onAction: (house: House, action: "archive" | "restore" | "delete") => void }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h2 className="text-xl font-black">Gestion des publications</h2>
        <p className="mt-1 text-sm text-muted">Modération, archivage et suppression des annonces publiées.</p>
      </div>
      {houses.map(house => {
        const archived = house.status === "Archivé";
        return (
          <div key={house.id} className="rounded-2xl bg-white p-5 shadow-card">
            <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-black">{house.title}</h3>
                  <Badge tone={house.status === "Disponible" ? "success" : "warn"}>{house.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">{house.commune}, {house.city} - {house.owner}</p>
                <p className="mt-3 text-sm leading-6 text-slate-700">{house.description}</p>
                <details className="mt-3">
                  <summary className="inline-flex cursor-pointer items-center gap-1 text-sm font-bold text-brand-700"><Eye size={15} /> Détails publication</summary>
                  <div className="mt-2 grid gap-2 rounded-xl bg-slate-50 p-3 text-sm md:grid-cols-3">
                    <p>Type : <strong>{house.type}</strong></p>
                    <p>Pièces : <strong>{house.rooms}</strong></p>
                    <p>Loyer : <strong>{money(house.price)}</strong></p>
                    <p className="md:col-span-3">ID : {house.id}</p>
                  </div>
                </details>
              </div>
              <div className="grid content-start gap-2">
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
  );
}
