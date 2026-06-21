"use client";

import { Eye, FileSignature } from "lucide-react";
import { Badge } from "@/components/ui";
import { money } from "@/lib/utils";
import type { Contract } from "@/types";

export function AdminContracts({ contracts }: { contracts: Contract[] }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileSignature className="text-brand-600" size={20} />
          <div>
            <h2 className="text-xl font-black">Historique des contrats</h2>
            <p className="text-sm text-muted">Tous les contrats créés et signés sur la plateforme.</p>
          </div>
        </div>
        <Badge>{contracts.length} contrats</Badge>
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Contrat</th>
              <th className="px-3 py-2">Bailleur</th>
              <th className="px-3 py-2">Locataire</th>
              <th className="px-3 py-2">Loyer</th>
              <th className="px-3 py-2">Accords</th>
              <th className="px-3 py-2">Signatures</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Détails</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map(contract => (
              <tr key={contract.id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-3 font-bold">{contract.seal}</td>
                <td className="px-3 py-3">{contract.owner}</td>
                <td className="px-3 py-3">{contract.tenant}</td>
                <td className="px-3 py-3">{money(contract.rent)}</td>
                <td className="px-3 py-3 text-xs leading-5">
                  <p>Bailleur : {contract.agreedByOwnerAt ? "validé" : "en attente"}</p>
                  <p>Locataire : {contract.agreedByTenantAt ? "validé" : "en attente"}</p>
                </td>
                <td className="px-3 py-3 text-xs leading-5">
                  <p>Bailleur : {contract.signedByOwnerAt ? "signé" : "non signé"}</p>
                  <p>Locataire : {contract.signedByTenantAt ? "signé" : "non signé"}</p>
                </td>
                <td className="px-3 py-3"><Badge tone={["signe", "signé"].includes(contract.status) ? "success" : "default"}>{contract.status}</Badge></td>
                <td className="px-3 py-3">
                  <details>
                    <summary className="inline-flex cursor-pointer items-center gap-1 font-bold text-brand-700"><Eye size={15} /> Ouvrir</summary>
                    <div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs leading-5">
                      <p>ID contrat : {contract.id}</p>
                      <p>ID maison : {contract.houseId}</p>
                      <p>Date début : {contract.startDate}</p>
                      <p>Durée : {contract.duration}</p>
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
