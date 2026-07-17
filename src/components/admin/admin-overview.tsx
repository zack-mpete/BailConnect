"use client";

import {
  Activity,
  Archive,
  CheckCircle2,
  Clock3,
  FileSignature,
  Home,
  Users,
  XCircle
} from "lucide-react";
import { Badge } from "@/components/ui";
import { CONTRACT_STATUS_LABELS } from "@/lib/statuses";
import type { AppData } from "@/types";

type DistributionItem = {
  label: string;
  value: number;
  color: string;
};

function DistributionChart({ items, total }: { items: DistributionItem[]; total: number }) {
  const denominator = Math.max(total, 1);

  return (
    <div className="mt-5 space-y-4">
      {items.map(item => {
        const percentage = Math.round((item.value / denominator) * 100);
        return (
          <div key={item.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="font-bold text-slate-700">{item.label}</span>
              <span className="font-black text-slate-950">{item.value} <span className="text-xs text-muted">({percentage}%)</span></span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AdminOverview({ data }: { data: AppData }) {
  const agreedContracts = data.contracts.filter(contract => contract.agreedByOwnerAt && contract.agreedByTenantAt).length;
  const archivedHouses = data.houses.filter(house => house.isArchived).length;
  const pendingPublications = data.houses.filter(house => house.publicationStatus === "en_attente").length;
  const rejectedPublications = data.houses.filter(house => house.publicationStatus === "rejetee").length;
  const validatedPublications = data.houses.filter(house => house.publicationStatus === "validee" && !house.isArchived).length;

  const metrics = [
    {
      label: "Contrats validés",
      value: agreedContracts,
      Icon: CheckCircle2,
      card: "from-emerald-50 to-white border-emerald-100",
      icon: "bg-emerald-100 text-emerald-700"
    },
    {
      label: "Contrats suivis",
      value: data.contracts.length,
      Icon: FileSignature,
      card: "from-violet-50 to-white border-violet-100",
      icon: "bg-violet-100 text-violet-700"
    },
    {
      label: "Publications",
      value: data.houses.length,
      Icon: Home,
      card: "from-cyan-50 to-white border-cyan-100",
      icon: "bg-cyan-100 text-cyan-700"
    },
    {
      label: "Utilisateurs",
      value: data.users.length,
      Icon: Users,
      card: "from-amber-50 to-white border-amber-100",
      icon: "bg-amber-100 text-amber-700"
    }
  ];

  const publicationDistribution: DistributionItem[] = [
    { label: "Validées et actives", value: validatedPublications, color: "bg-emerald-500" },
    { label: "En attente", value: pendingPublications, color: "bg-amber-500" },
    { label: "Rejetées", value: rejectedPublications, color: "bg-rose-500" },
    { label: "Archivées", value: archivedHouses, color: "bg-slate-500" }
  ];

  const contractDistribution: DistributionItem[] = [
    {
      label: "Signés",
      value: data.contracts.filter(contract => contract.status === "signe").length,
      color: "bg-emerald-500"
    },
    {
      label: "En préparation",
      value: data.contracts.filter(contract => ["brouillon", "pret_a_signer"].includes(contract.status)).length,
      color: "bg-cyan-500"
    },
    {
      label: "Résiliation programmée",
      value: data.contracts.filter(contract => contract.status === "resiliation_programmee").length,
      color: "bg-amber-500"
    },
    {
      label: "Terminés",
      value: data.contracts.filter(contract => ["resilie", "annule"].includes(contract.status)).length,
      color: "bg-slate-500"
    }
  ];

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-cyan-950 to-brand-900 p-5 text-white shadow-soft">
        <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full bg-cyan-300/15 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-cyan-200">
              <Activity size={18} />
              <p className="text-xs font-black uppercase tracking-[0.18em]">Pilotage en temps réel</p>
            </div>
            <h1 className="mt-2 text-2xl font-black md:text-3xl">Vue d’ensemble de la plateforme</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
              Modération, contrats, occupation et utilisateurs réunis dans un seul centre de contrôle.
            </p>
          </div>
          <Badge tone={pendingPublications > 0 ? "warn" : "success"}>
            {pendingPublications} publication(s) à traiter
          </Badge>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, Icon, card, icon }) => (
          <div key={label} className={`rounded-2xl border bg-gradient-to-br p-4 shadow-card ${card}`}>
            <div className={`icon-chip ${icon}`}><Icon size={19} /></div>
            <p className="mt-4 text-3xl font-black tracking-tight">{value}</p>
            <p className="text-sm font-semibold text-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="surface-card border border-cyan-100/70">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Archive className="text-cyan-700" size={20} />
              <h2 className="font-black">État des publications</h2>
            </div>
            <span className="text-xs font-bold text-muted">{data.houses.length} au total</span>
          </div>
          <DistributionChart items={publicationDistribution} total={data.houses.length} />
        </div>

        <div className="surface-card border border-violet-100/70">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileSignature className="text-violet-700" size={20} />
              <h2 className="font-black">Cycle des contrats</h2>
            </div>
            <span className="text-xs font-bold text-muted">{data.contracts.length} au total</span>
          </div>
          <DistributionChart items={contractDistribution} total={data.contracts.length} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <div className="surface-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-black">Contrats récents</h2>
            <Clock3 className="text-brand-600" size={19} />
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {data.contracts.slice(0, 6).map(contract => (
              <div key={contract.id} className="rounded-xl border border-slate-100 bg-gradient-to-br from-white to-slate-50 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black">{contract.seal}</p>
                  <Badge tone={contract.status === "signe" ? "success" : contract.status === "resiliation_programmee" ? "warn" : "default"}>
                    {CONTRACT_STATUS_LABELS[contract.status]}
                  </Badge>
                </div>
                <p className="mt-2 truncate text-muted">{contract.owner} / {contract.tenant}</p>
              </div>
            ))}
            {!data.contracts.length && (
              <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-muted">Aucun contrat enregistré.</p>
            )}
          </div>
        </div>

        <div className="surface-card bg-gradient-to-br from-rose-50 via-white to-amber-50">
          <div className="flex items-center gap-2">
            <XCircle className="text-rose-600" size={20} />
            <h2 className="font-black">À surveiller</h2>
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-white/80 p-3">
              <p className="text-xs font-bold text-muted">Publications rejetées</p>
              <p className="mt-1 text-2xl font-black text-rose-700">{rejectedPublications}</p>
            </div>
            <div className="rounded-xl bg-white/80 p-3">
              <p className="text-xs font-bold text-muted">Résiliations à suivre</p>
              <p className="mt-1 text-2xl font-black text-amber-700">
                {data.contracts.filter(contract => contract.status === "resiliation_programmee").length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
