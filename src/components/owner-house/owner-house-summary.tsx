"use client";

import Image from "next/image";
import { FileSignature } from "lucide-react";
import { Badge } from "@/components/ui";
import { money } from "@/lib/utils";
import type { Contract, House } from "@/types";
import { publicationLabel } from "@/lib/statuses";

type OwnerHouseSummaryProps = {
  house: House;
  contracts: Contract[];
  canEdit?: boolean;
};

export function OwnerHouseSummary({ house, contracts, canEdit = false }: OwnerHouseSummaryProps) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-card">
      {house.image && (
        <div className="relative h-52 w-full min-[390px]:h-64 sm:h-72">
          <Image
            src={house.image}
            alt={house.title}
            fill
            sizes="(min-width: 1280px) 70vw, 100vw"
            className="object-cover"
          />
        </div>
      )}

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-black sm:text-3xl">{house.title}</h1>
            <p className="mt-1 text-sm text-muted">
              {house.district ? `${house.district}, ` : ""}
              {house.commune}, {house.city}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <a
                href="#modifier-contrat"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-black text-white"
              >
                <FileSignature size={16} /> Modifier le modèle
              </a>
            )}
            {house.isArchived && <Badge tone="warn">Archivé</Badge>}
            <Badge tone={house.status === "Disponible" ? "success" : "warn"}>{house.status}</Badge>
            <Badge tone={house.isValid ? "success" : "warn"}>
              {publicationLabel(house)}
            </Badge>
          </div>
        </div>

        <div className="mt-5 grid gap-3 min-[360px]:grid-cols-2 md:grid-cols-4">
          <div className="soft-tile">
            <p className="text-xs font-bold text-muted">Loyer</p>
            <p className="break-words font-black">{money(house.price)}</p>
          </div>
          <div className="soft-tile">
            <p className="text-xs font-bold text-muted">Pieces</p>
            <p className="font-black">{house.rooms}</p>
          </div>
          <div className="soft-tile">
            <p className="text-xs font-bold text-muted">Type</p>
            <p className="font-black">{house.type}</p>
          </div>
          <div className="soft-tile">
            <p className="text-xs font-bold text-muted">Contrats</p>
            <p className="font-black">{contracts.length}</p>
          </div>
        </div>
      </div>
      {house.publicationRejectionReason && (
        <p className="mx-5 mb-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
          Publication rejetée : {house.publicationRejectionReason}
        </p>
      )}
    </div>
  );
}
