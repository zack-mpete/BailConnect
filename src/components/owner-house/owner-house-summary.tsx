"use client";

import Image from "next/image";
import { FileSignature } from "lucide-react";
import { Badge } from "@/components/ui";
import { money } from "@/lib/utils";
import type { Contract, House } from "@/types";

type OwnerHouseSummaryProps = {
  house: House;
  contracts: Contract[];
};

export function OwnerHouseSummary({ house, contracts }: OwnerHouseSummaryProps) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-card">
      {house.image && (
        <div className="relative h-72 w-full">
          <Image
            src={house.image}
            alt={house.title}
            fill
            sizes="(min-width: 1280px) 70vw, 100vw"
            className="object-cover"
          />
        </div>
      )}

      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">{house.title}</h1>
            <p className="mt-1 text-sm text-muted">
              {house.district ? `${house.district}, ` : ""}
              {house.commune}, {house.city}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="#modifier-contrat"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-black text-white"
            >
              <FileSignature size={16} /> Modifier le contrat
            </a>
            <Badge tone={house.status === "Disponible" ? "success" : "warn"}>{house.status}</Badge>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="soft-tile">
            <p className="text-xs font-bold text-muted">Loyer</p>
            <p className="font-black">{money(house.price)}</p>
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
    </div>
  );
}
