"use client";

import { Archive, FileSignature, Home, Users } from "lucide-react";
import type { AppData } from "@/types";

export function AdminOverview({ data }: { data: AppData }) {
  const signedContracts = data.contracts.filter(contract => contract.signedByOwnerAt && contract.signedByTenantAt).length;
  const archivedHouses = data.houses.filter(house => house.status === "Archivé").length;
  const metrics = [
    { label: "Contrats signés", value: signedContracts, Icon: FileSignature },
    { label: "Contrats suivis", value: data.contracts.length, Icon: FileSignature },
    { label: "Publications", value: data.houses.length, Icon: Home },
    { label: "Utilisateurs", value: data.users.length, Icon: Users }
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold uppercase text-brand-700">Vue d'ensemble</p>
        <h2 className="text-2xl font-black">Supervision plateforme</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, Icon }) => (
          <div key={label} className="rounded-2xl bg-white p-4 shadow-card">
            <Icon className="text-brand-600" size={20} />
            <p className="mt-4 text-3xl font-black">{value}</p>
            <p className="text-sm font-semibold text-muted">{label}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="flex items-center gap-2">
            <Archive className="text-brand-600" size={20} />
            <h3 className="font-black">État des publications</h3>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-muted">Actives</p>
              <p className="text-xl font-black">{data.houses.length - archivedHouses}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-muted">Archivées</p>
              <p className="text-xl font-black">{archivedHouses}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="font-black">Contrats récents</h3>
          <div className="mt-4 space-y-2">
            {data.contracts.slice(0, 4).map(contract => (
              <div key={contract.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="font-bold">{contract.seal}</p>
                <p className="text-muted">{contract.owner} / {contract.tenant}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
