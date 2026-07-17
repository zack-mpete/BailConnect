"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth-client";
import { houseDetailHref } from "@/lib/house-links";
import { money } from "@/lib/utils";
import type { House } from "@/types";

const LeafletHousesMap = dynamic(() => import("@/components/leaflet-maps").then(mod => mod.LeafletHousesMap), {
  ssr: false,
  loading: () => <div className="flex h-[420px] items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-muted">Chargement de la carte...</div>
});

function hasCoords(house: House) {
  return typeof house.latitude === "number" && typeof house.longitude === "number" && Number.isFinite(house.latitude) && Number.isFinite(house.longitude);
}

export function DashboardMap({ houses, title = "Vue map", subtitle = "Localisation des biens suivis." }: { houses: House[]; title?: string; subtitle?: string }) {
  const { user } = useCurrentUser();
  const locatedHouses = houses.filter(hasCoords);
  const missingLocation = houses.filter(house => !hasCoords(house));
  const getHouseHref = (house: House) => houseDetailHref(house, user);

  return (
    <div className="surface-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">{title}</h2>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="success">{locatedHouses.length} localises</Badge>
          {missingLocation.length > 0 && <Badge tone="warn">{missingLocation.length} a placer</Badge>}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_300px]">
        <LeafletHousesMap houses={locatedHouses} getHouseHref={getHouseHref} />

        <div className="space-y-2">
          {locatedHouses.slice(0, 7).map(house => (
            <Link key={house.id} href={getHouseHref(house)} className="block soft-tile text-sm transition hover:bg-brand-50">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-bold">{house.title}</p>
                  <p className="truncate text-xs text-muted">{house.district ? `${house.district}, ` : ""}{house.commune}, {house.city}</p>
                  <p className="mt-1 text-xs font-bold text-slate-600">{money(house.price)}</p>
                </div>
                <Badge tone={house.status === "Disponible" ? "success" : "warn"}>{house.status}</Badge>
              </div>
            </Link>
          ))}

          {missingLocation.length > 0 && (
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              <div className="flex items-center gap-2 font-black"><MapPin size={16} /> Biens a localiser</div>
              <div className="mt-2 space-y-1">
                {missingLocation.slice(0, 5).map(house => <p key={house.id} className="truncate text-xs font-semibold">{house.title} - {house.commune}</p>)}
              </div>
            </div>
          )}

          {!houses.length && <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-muted">Aucun bien a afficher sur la carte.</p>}
        </div>
      </div>
    </div>
  );
}
