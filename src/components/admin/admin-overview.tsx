"use client";

import { Archive, FileSignature, Home, Users } from "lucide-react";
import type { AppData } from "@/types";

export function AdminOverview({ data }: { data: AppData }) {
  const agreedContracts = data.contracts.filter(contract => contract.agreedByOwnerAt && contract.agreedByTenantAt).length;
  const archivedHouses = data.houses.filter(house => house.status === "Archivé").length;
  const metrics = [
    { label: "Contrats validés", value: agreedContracts, Icon: FileSignature },
    { label: "Contrats suivis", value: data.contracts.length, Icon: FileSignature },
    { label: "Publications", value: data.houses.length, Icon: Home },
    { label: "Utilisateurs", value: data.users.length, Icon: Users }
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, Icon }) => (
          <div key={label} className="rounded-2xl bg-white p-3 shadow-card">
            <Icon className="text-brand-600" size={20} />
            <p className="mt-2 text-2xl font-black">{value}</p>
            <p className="text-sm font-semibold text-muted">{label}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="surface-card">
          <div className="flex items-center gap-2">
            <Archive className="text-brand-600" size={20} />
            <h3 className="font-black">État des publications</h3>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="soft-tile">
              <p className="text-muted">Actives</p>
              <p className="text-xl font-black">{data.houses.length - archivedHouses}</p>
            </div>
            <div className="soft-tile">
              <p className="text-muted">Archivées</p>
              <p className="text-xl font-black">{archivedHouses}</p>
            </div>
          </div>
        </div>
        <div className="surface-card">
          <h3 className="font-black">Contrats récents</h3>
          <div className="mt-4 space-y-2">
            {data.contracts.slice(0, 4).map(contract => (
              <div key={contract.id} className="soft-tile text-sm">
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
