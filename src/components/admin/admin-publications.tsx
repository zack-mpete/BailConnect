"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, CheckCircle2, Eye, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui";
import { houseManagerHref } from "@/lib/house-links";
import type { House } from "@/types";
import { publicationLabel } from "@/lib/statuses";

type PublicationAction = "archive" | "restore" | "approve" | "reject" | "delete";

export function AdminPublications({
  houses,
  onAction
}: {
  houses: House[];
  onAction: (house: House, action: PublicationAction, reason?: string) => void;
}) {
  const [rejectedHouse, setRejectedHouse] = useState<House | null>(null);
  const [reason, setReason] = useState("");
  const orderedHouses = [...houses].sort((a, b) => {
    if (a.isValid === b.isValid) return b.publishedAt.localeCompare(a.publishedAt);
    return a.isValid ? 1 : -1;
  });

  return (
    <div className="space-y-3">
      <div className="surface-card border border-cyan-100/70 bg-gradient-to-r from-white to-cyan-50/50">
        <h2 className="text-xl font-black">Gestion des publications</h2>
        <p className="mt-1 text-sm text-muted">Modération, archivage et suppression des annonces publiées.</p>
      </div>
      <div className="grid gap-3 lg:max-h-[calc(100dvh-220px)] lg:overflow-y-auto lg:pr-1 scrollbar-soft">
        {orderedHouses.map(house => {
          const archived = house.isArchived;
          const validated = house.isValid;
          const rejected = !house.isValid && Boolean(house.publicationRejectionReason);
          return (
            <div key={house.id} className="surface-card border border-slate-100 transition hover:border-cyan-200 hover:shadow-soft">
              <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="min-w-0 truncate text-lg font-black">{house.title}</h3>
                    <Badge tone={house.status === "Disponible" ? "success" : "warn"}>{house.status}</Badge>
                    {archived && <Badge tone="warn">Archivée</Badge>}
                    <Badge tone={validated ? "success" : rejected ? "warn" : "default"}>
                      {publicationLabel(house)}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted">{house.commune}, {house.city} - {house.owner}</p>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-700">{house.description}</p>
                  {house.publicationRejectionReason && (
                    <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
                      Motif : {house.publicationRejectionReason}
                    </p>
                  )}
                  <Link
                    href={houseManagerHref(house.id)}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-brand-700"
                  >
                    <Eye size={15} /> Détail publication
                  </Link>
                </div>
                <div className="grid content-start gap-2">
                  <button onClick={() => onAction(house, "approve")} disabled={validated} className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                    <CheckCircle2 size={16} />
                    {validated ? "Validée" : "Valider"}
                  </button>
                  <button
                    onClick={() => {
                      setRejectedHouse(house);
                      setReason(house.publicationRejectionReason || "");
                    }}
                    disabled={rejected}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800 disabled:opacity-60"
                  >
                    Rejeter
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
        {!orderedHouses.length && (
          <p className="surface-card text-sm font-semibold text-muted">Aucune publication à afficher.</p>
        )}
      </div>
      {rejectedHouse && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="reject-publication-title">
          <div className="safe-modal-panel w-full max-w-lg rounded-2xl bg-white p-4 shadow-soft sm:p-5">
            <h3 id="reject-publication-title" className="text-xl font-black">Rejeter la publication</h3>
            <p className="mt-2 text-sm text-muted">{rejectedHouse.title}</p>
            <label className="mt-4 block text-sm font-bold">
              Motif du rejet
              <textarea
                autoFocus
                value={reason}
                onChange={event => setReason(event.target.value)}
                rows={4}
                className="mt-2 form-control"
                placeholder="Explique les corrections attendues..."
              />
            </label>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={() => setRejectedHouse(null)} className="rounded-full bg-slate-100 px-4 py-3 text-sm font-bold">Annuler</button>
              <button
                disabled={reason.trim().length < 3}
                onClick={() => {
                  onAction(rejectedHouse, "reject", reason.trim());
                  setRejectedHouse(null);
                }}
                className="rounded-full bg-red-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
