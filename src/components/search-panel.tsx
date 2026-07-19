"use client";

import { useMemo, useState } from "react";
import type { House } from "@/types";
import { HouseCard } from "@/components/house-card";
import { filterHouses, getHouseSearchBudgetCeiling } from "@/lib/house-search";

export function SearchPanel({ houses }: { houses: House[] }) {
  const [query, setQuery] = useState("");
  const budgetCeiling = getHouseSearchBudgetCeiling(houses);
  const [max, setMax] = useState(budgetCeiling);
  const [type, setType] = useState("Tous");
  const types = ["Tous", ...Array.from(new Set(houses.map(h => h.type)))];

  const results = useMemo(
    () => filterHouses(houses, { query, type, maxPrice: max }),
    [houses, query, max, type]
  );

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-3">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher par commune, ville, type..." className="form-control" />
          <select value={type} onChange={e => setType(e.target.value)} className="form-control">{types.map(t => <option key={t}>{t}</option>)}</select>
          <label className="form-control py-2 text-sm font-semibold text-slate-600">Budget max: ${max}<input type="range" min="0" max={budgetCeiling} step="50" value={max} onChange={e => setMax(Number(e.target.value))} className="mt-2 w-full" /></label>
        </div>
      </div>
      <p className="text-sm font-semibold text-muted">{results.length} résultat(s)</p>
      {results.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {results.map(house => <HouseCard key={house.id} house={house} />)}
        </div>
      ) : (
        <div className="surface-card text-center">
          <h2 className="text-lg font-black">Aucun résultat</h2>
          <p className="mt-2 text-sm text-muted">Modifie le texte, le type ou le budget maximum.</p>
        </div>
      )}
    </div>
  );
}
