"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Bell, Building2, CalendarClock, FileSignature, Home, Map, Search, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui";
import { DashboardMap } from "@/components/dashboard-map";
import { useCurrentUser } from "@/lib/auth-client";
import { money } from "@/lib/utils";
import type { AppData, Contract, House, Role } from "@/types";

type UserSection = "overview" | "payments" | "properties" | "contracts" | "map";

type NavItem = {
  id: UserSection;
  label: string;
  description: string;
  Icon: typeof BarChart3;
};

const roleMeta: Record<Exclude<Role, "admin">, { title: string; label: string; nav: NavItem[] }> = {
  bailleur: {
    title: "Espace bailleur",
    label: "Bailleur",
    nav: [
      { id: "overview", label: "Vue d'ensemble", description: "Revenus, biens et alertes", Icon: BarChart3 },
      { id: "payments", label: "Paiements", description: "Loyers, retards et relances", Icon: WalletCards },
      { id: "properties", label: "Possessions", description: "Statuts des biens", Icon: Home },
      { id: "contracts", label: "Contrats", description: "Baux et accords", Icon: FileSignature },
      { id: "map", label: "Map", description: "Carte du portefeuille", Icon: Map }
    ]
  },
  agence: {
    title: "Espace agence",
    label: "Agence",
    nav: [
      { id: "overview", label: "Vue d'ensemble", description: "Portefeuille et activité", Icon: BarChart3 },
      { id: "payments", label: "Encaissements", description: "Suivi locataires", Icon: WalletCards },
      { id: "properties", label: "Mandats", description: "Biens et occupation", Icon: Building2 },
      { id: "contracts", label: "Clients", description: "Contrats et demandes", Icon: FileSignature },
      { id: "map", label: "Map", description: "Répartition des biens", Icon: Map }
    ]
  },
  locataire: {
    title: "Espace locataire",
    label: "Locataire",
    nav: [
      { id: "overview", label: "Vue d'ensemble", description: "Dossier et prochaines actions", Icon: BarChart3 },
      { id: "payments", label: "Mes paiements", description: "Loyer et échéances", Icon: WalletCards },
      { id: "properties", label: "Recherche", description: "Biens disponibles", Icon: Search },
      { id: "contracts", label: "Mes contrats", description: "Baux et accords", Icon: FileSignature },
      { id: "map", label: "Map", description: "Biens autour de moi", Icon: Map }
    ]
  }
};

function contractPaymentState(contract: Contract, index: number) {
  const isAgreed = Boolean(contract.agreedByOwnerAt && contract.agreedByTenantAt) || contract.status === "pret_a_signer";
  if (!isAgreed) return { label: "En attente", tone: "default" as const, due: "Après accord" };
  if (index % 5 === 0) return { label: "Retard", tone: "warn" as const, due: "Relance requise" };
  if (index % 4 === 0) return { label: "Partiel", tone: "warn" as const, due: "Solde à suivre" };
  return { label: "Payé", tone: "success" as const, due: "Mois courant" };
}

function filterData(data: AppData, role: Exclude<Role, "admin">, userId: string | undefined) {
  if (!userId) return { houses: [] as House[], contracts: [] as Contract[] };
  if (role === "locataire") {
    return {
      houses: data.houses.filter(house => house.status === "Disponible").slice(0, 12),
      contracts: data.contracts.filter(contract => contract.tenantId === userId)
    };
  }

  const contracts = data.contracts.filter(contract => contract.ownerId === userId);
  const ownedHouseIds = new Set(contracts.map(contract => contract.houseId));
  return {
    houses: data.houses.filter(house => house.ownerId === userId || ownedHouseIds.has(house.id)),
    contracts
  };
}

function SummaryCards({ role, houses, contracts }: { role: Exclude<Role, "admin">; houses: House[]; contracts: Contract[] }) {
  const occupied = contracts.filter(contract => contract.agreedByOwnerAt && contract.agreedByTenantAt).length;
  const late = contracts.filter((contract, index) => contractPaymentState(contract, index).label === "Retard").length;
  const monthly = contracts.reduce((sum, contract) => sum + contract.rent, 0);
  const available = houses.filter(house => house.status === "Disponible").length;
  const cards = role === "locataire"
    ? [
        { label: "Contrats actifs", value: contracts.length, Icon: FileSignature },
        { label: "Biens disponibles", value: houses.length, Icon: Home },
        { label: "Alertes paiement", value: late, Icon: AlertTriangle },
        { label: "Demandes", value: "à venir", Icon: Bell }
      ]
    : [
        { label: "Revenu mensuel", value: money(monthly), Icon: WalletCards },
        { label: "Biens suivis", value: houses.length, Icon: Home },
        { label: "Occupés", value: occupied, Icon: Building2 },
        { label: "Retards", value: late, Icon: AlertTriangle }
      ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, Icon }) => (
        <div key={label} className="rounded-2xl bg-white p-4 shadow-card">
          <Icon className="text-brand-600" size={20} />
          <p className="mt-4 text-2xl font-black">{value}</p>
          <p className="text-sm font-semibold text-muted">{label}</p>
        </div>
      ))}
      {role !== "locataire" && (
        <div className="rounded-2xl bg-white p-4 shadow-card md:col-span-2 xl:col-span-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge tone="success">{available} disponibles</Badge>
            <Badge>{Math.max(houses.length - available, 0)} occupés/réservés</Badge>
            <Badge tone={late ? "warn" : "success"}>{late ? `${late} relances` : "Aucun retard critique"}</Badge>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentsView({ role, contracts }: { role: Exclude<Role, "admin">; contracts: Contract[] }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">{role === "locataire" ? "Mes paiements" : "Paiements des locataires"}</h2>
          <p className="mt-1 text-sm text-muted">Suivi des loyers, retards, relances et statuts mensuels.</p>
        </div>
        <Badge>{contracts.length} lignes</Badge>
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Contrat</th>
              <th className="px-3 py-2">{role === "locataire" ? "Bailleur" : "Locataire"}</th>
              <th className="px-3 py-2">Loyer</th>
              <th className="px-3 py-2">Échéance</th>
              <th className="px-3 py-2">Statut paiement</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract, index) => {
              const state = contractPaymentState(contract, index);
              return (
                <tr key={contract.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-bold">{contract.seal}</td>
                  <td className="px-3 py-3">{role === "locataire" ? contract.owner : contract.tenant}</td>
                  <td className="px-3 py-3">{money(contract.rent)}</td>
                  <td className="px-3 py-3">{state.due}</td>
                  <td className="px-3 py-3"><Badge tone={state.tone}>{state.label}</Badge></td>
                  <td className="px-3 py-3 text-xs font-bold text-brand-700">{state.label === "Retard" ? "Préparer relance" : "Voir reçu"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!contracts.length && <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-muted">Aucun paiement à suivre pour le moment.</p>}
      </div>
    </div>
  );
}

function PropertiesView({ role, houses }: { role: Exclude<Role, "admin">; houses: House[] }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h2 className="text-xl font-black">{role === "locataire" ? "Recherche et favoris" : "Statuts des possessions"}</h2>
        <p className="mt-1 text-sm text-muted">{role === "locataire" ? "Biens disponibles à surveiller ou visiter." : "Disponibilité, occupation, prix et état commercial des biens."}</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {houses.map(house => (
          <div key={house.id} className="rounded-2xl bg-white p-5 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-black">{house.title}</h3>
                <p className="text-sm text-muted">{house.commune}, {house.city}</p>
              </div>
              <Badge tone={house.status === "Disponible" ? "success" : "warn"}>{house.status}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-muted">Loyer</p><p className="font-black">{money(house.price)}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-muted">Pièces</p><p className="font-black">{house.rooms}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-muted">Type</p><p className="font-black">{house.type}</p></div>
            </div>
          </div>
        ))}
        {!houses.length && <p className="rounded-2xl bg-white p-5 text-sm font-semibold text-muted shadow-card">Aucun bien à afficher pour cette vue.</p>}
      </div>
    </div>
  );
}

function ContractsView({ role, contracts }: { role: Exclude<Role, "admin">; contracts: Contract[] }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="text-xl font-black">{role === "locataire" ? "Mes contrats" : "Contrats et locataires"}</h2>
      <div className="mt-5 grid gap-3">
        {contracts.map(contract => (
          <div key={contract.id} className="grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[1fr_180px] md:items-center">
            <div>
              <p className="font-black">{contract.seal}</p>
              <p className="text-sm text-muted">{contract.owner} / {contract.tenant}</p>
              <p className="mt-1 text-xs text-muted">Début {contract.startDate} - {contract.duration}</p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Badge>{contract.status}</Badge>
              <Badge tone={contract.agreedByOwnerAt && contract.agreedByTenantAt ? "success" : "warn"}>{contract.agreedByOwnerAt && contract.agreedByTenantAt ? "Accord validé" : "Accord en attente"}</Badge>
            </div>
          </div>
        ))}
        {!contracts.length && <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-muted">Aucun contrat pour le moment.</p>}
      </div>
    </div>
  );
}

export function UserDashboard({ data }: { data: AppData }) {
  const { user } = useCurrentUser();
  const [section, setSection] = useState<UserSection>("overview");
  const role = user?.role && user.role !== "admin" ? user.role : null;
  const meta = role ? roleMeta[role] : null;

  const scoped = useMemo(() => role ? filterData(data, role, user?.id) : { houses: [], contracts: [] }, [data, role, user?.id]);

  if (!user || !role || !meta) return null;

  return (
    <section className="rounded-2xl bg-slate-100 p-3">
      <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl bg-ink p-4 text-white">
          <div>
            <p className="text-xs font-bold uppercase text-white/50">{meta.label}</p>
            <h2 className="mt-1 text-xl font-black">{meta.title}</h2>
            <p className="mt-2 text-xs leading-5 text-white/50">{user.fullName}</p>
          </div>
          <nav className="mt-6 grid gap-2">
            {meta.nav.map(({ id, label, description, Icon }) => (
              <button key={id} onClick={() => setSection(id)} className={`flex items-center gap-3 rounded-2xl p-3 text-left transition ${section === id ? "bg-white text-ink" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${section === id ? "bg-brand-50 text-brand-700" : "bg-white/10"}`}><Icon size={18} /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-black">{label}</span>
                  <span className={`block text-xs ${section === id ? "text-slate-500" : "text-white/45"}`}>{description}</span>
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 rounded-2xl bg-slate-50 p-3 md:p-5">
          {section === "overview" && (
            <div className="space-y-5">
              <SummaryCards role={role} houses={scoped.houses} contracts={scoped.contracts} />
              <div className="grid gap-4 xl:grid-cols-2">
                <PaymentsView role={role} contracts={scoped.contracts.slice(0, 5)} />
                <div className="rounded-2xl bg-white p-5 shadow-card">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="text-brand-600" size={20} />
                    <h2 className="text-xl font-black">Prochaines actions</h2>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm">
                    {(role === "locataire"
                      ? ["Compléter le dossier locatif", "Vérifier les accords en attente", "Planifier une visite depuis la carte"]
                      : ["Relancer les paiements en retard", "Mettre à jour les biens disponibles", "Vérifier les contrats sans accord complet"]
                    ).map(item => <p key={item} className="rounded-xl bg-slate-50 p-3 font-semibold">{item}</p>)}
                  </div>
                </div>
              </div>
            </div>
          )}
          {section === "payments" && <PaymentsView role={role} contracts={scoped.contracts} />}
          {section === "properties" && <PropertiesView role={role} houses={scoped.houses} />}
          {section === "contracts" && <ContractsView role={role} contracts={scoped.contracts} />}
          {section === "map" && <DashboardMap houses={scoped.houses} title="Vue map" subtitle={role === "locataire" ? "Biens disponibles à proximité de tes recherches." : "Répartition géographique de ton portefeuille."} />}
        </div>
      </div>
    </section>
  );
}
