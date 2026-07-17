"use client";

import { useMemo, useState } from "react";
import { House } from "@/types";
import { HouseCard } from "@/components/house-card";

export function SearchPanel({ houses }: { houses: House[] }) {
  const [query, setQuery] = useState("");
  const [max, setMax] = useState(1000);
  const [type, setType] = useState("Tous");
  const types = ["Tous", ...Array.from(new Set(houses.map(h => h.type)))];

  const results = useMemo(() => houses.filter(h => {
    const matchText = `${h.title} ${h.city} ${h.commune} ${h.description}`.toLowerCase().includes(query.toLowerCase());
    const matchType = type === "Tous" || h.type === type;
    return matchText && matchType && h.price <= max;
  }), [houses, query, max, type]);

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-3">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher par commune, ville, type..." className="form-control" />
          <select value={type} onChange={e => setType(e.target.value)} className="form-control">{types.map(t => <option key={t}>{t}</option>)}</select>
          <label className="form-control py-2 text-sm font-semibold text-slate-600">Budget max: ${max}<input type="range" min="150" max="1200" step="50" value={max} onChange={e => setMax(Number(e.target.value))} className="mt-2 w-full" /></label>
        </div>
      </div>
      <p className="text-sm font-semibold text-muted">{results.length} résultat(s)</p>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{results.map(h => <HouseCard key={h.id} house={h} />)}</div>
    </div>
  );
}
