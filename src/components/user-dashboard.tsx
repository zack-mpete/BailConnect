"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Building2, CalendarClock, FileSignature, Home, Map, MessageSquare, PlusCircle, Search, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui";
import { DashboardMap } from "@/components/dashboard-map";
import { InternalMessageThread } from "@/components/internal-message-thread";
import { useCurrentUser } from "@/lib/auth-client";
import { houseContractHref, houseContractsHref, houseDetailHref, houseManagerHref, housePublicHref } from "@/lib/house-links";
import { getSupabaseAccessToken } from "@/lib/supabase";
import { money } from "@/lib/utils";
import type { AppData, Contract, House, Payment, Role } from "@/types";

type UserSection = "overview" | "payments" | "properties" | "contracts" | "messages" | "map";

const userSections: UserSection[] = ["overview", "payments", "properties", "contracts", "messages", "map"];

function isUserSection(value: string | null): value is UserSection {
  return Boolean(value && userSections.includes(value as UserSection));
}

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
      { id: "properties", label: "Possessions", description: "Biens a gerer", Icon: Home },
      { id: "contracts", label: "Contrats", description: "Baux et accords", Icon: FileSignature },
      { id: "messages", label: "Messagerie", description: "Conversations", Icon: MessageSquare },
      { id: "map", label: "Carte", description: "Portefeuille", Icon: Map }
    ]
  },
  agence: {
    title: "Espace agence",
    label: "Agence",
    nav: [
      { id: "overview", label: "Vue d'ensemble", description: "Portefeuille et activité", Icon: BarChart3 },
      { id: "payments", label: "Encaissements", description: "Suivi locataires", Icon: WalletCards },
      { id: "properties", label: "Possessions", description: "Mandats et occupation", Icon: Building2 },
      { id: "contracts", label: "Contrats", description: "Clients et demandes", Icon: FileSignature },
      { id: "messages", label: "Messagerie", description: "Conversations", Icon: MessageSquare },
      { id: "map", label: "Carte", description: "Repartition des biens", Icon: Map }
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
      { id: "messages", label: "Messagerie", description: "Conversations", Icon: MessageSquare },
      { id: "map", label: "Carte", description: "Biens autour de moi", Icon: Map }
    ]
  }
};

function formatPaymentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function initials(name?: string | null) {
  if (!name) return "U";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("") || "U";
}

function filterData(data: AppData, role: Exclude<Role, "admin">, userId: string | undefined) {
  if (!userId) return { houses: [] as House[], contracts: [] as Contract[], payments: [] as Payment[] };
  if (role === "locataire") {
    const contracts = data.contracts.filter(contract => contract.tenantId === userId);
    const payments = data.payments.filter(payment => payment.tenantId === userId);
    const linkedHouseIds = new Set([
      ...contracts.map(contract => contract.houseId),
      ...payments.map(payment => payment.houseId)
    ]);

    const linkedHouses = data.houses.filter(house => linkedHouseIds.has(house.id));
    const availableHouses = data.houses.filter(house => house.status === "Disponible" && !linkedHouseIds.has(house.id));

    return {
      houses: [...linkedHouses, ...availableHouses].slice(0, 12),
      contracts,
      payments
    };
  }

  const contracts = data.contracts.filter(contract => contract.ownerId === userId);
  const ownedHouseIds = new Set(contracts.map(contract => contract.houseId));
  return {
    houses: data.houses.filter(house => house.ownerId === userId || ownedHouseIds.has(house.id)),
    contracts,
    payments: data.payments.filter(payment => payment.ownerId === userId)
  };
}

function SummaryCards({ role, houses, contracts, payments }: { role: Exclude<Role, "admin">; houses: House[]; contracts: Contract[]; payments: Payment[] }) {
  const occupied = contracts.filter(contract => contract.agreedByOwnerAt && contract.agreedByTenantAt).length;
  const collected = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const paidThisMonth = payments.filter(payment => payment.period.startsWith(currentMonth) || payment.paidAt.startsWith(currentMonth)).length;
  const monthly = contracts.reduce((sum, contract) => sum + contract.rent, 0);
  const available = houses.filter(house => house.status === "Disponible").length;
  const cards = role === "locataire"
    ? [
        { label: "Contrats actifs", value: contracts.length, Icon: FileSignature },
        { label: "Biens disponibles", value: houses.length, Icon: Home },
        { label: "Paiements", value: payments.length, Icon: WalletCards },
        { label: "Ce mois", value: paidThisMonth, Icon: CalendarClock }
      ]
    : [
        { label: "Revenu mensuel", value: money(monthly), Icon: WalletCards },
        { label: "Biens suivis", value: houses.length, Icon: Home },
        { label: "Occupés", value: occupied, Icon: Building2 },
        { label: "Encaisse", value: money(collected), Icon: WalletCards }
      ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, Icon }) => (
        <div key={label} className="rounded-2xl bg-white p-3 shadow-card">
          <Icon className="text-brand-600" size={20} />
          <p className="mt-2 text-xl font-black">{value}</p>
          <p className="text-sm font-semibold text-muted">{label}</p>
        </div>
      ))}
      {role !== "locataire" && (
        <div className="rounded-2xl bg-white p-3 shadow-card md:col-span-2 xl:col-span-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge tone="success">{available} disponibles</Badge>
            <Badge>{Math.max(houses.length - available, 0)} occupés/réservés</Badge>
            <Badge tone="success">{paidThisMonth} paiement(s) ce mois</Badge>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentsView({ role, contracts, payments, houses, user }: { role: Exclude<Role, "admin">; contracts: Contract[]; payments: Payment[]; houses: House[]; user: { id: string; role: Role } }) {
  const contractByHouse = new globalThis.Map(contracts.map(contract => [contract.houseId, contract]));
  const houseById = new globalThis.Map(houses.map(house => [house.id, house]));

  return (
    <div className="surface-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">{role === "locataire" ? "Mes paiements" : "Paiements des locataires"}</h2>
          <p className="mt-1 text-sm text-muted">Paiements réellement enregistrés sur les propriétés et occupants liés.</p>
        </div>
        <Badge>{payments.length} paiement(s)</Badge>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Propriété</th>
              <th className="px-3 py-2">Occupant</th>
              <th className="px-3 py-2">Période</th>
              <th className="px-3 py-2">Montant</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Méthode</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {payments.map(payment => {
              const contract = contractByHouse.get(payment.houseId);
              const house = houseById.get(payment.houseId);
              const href = house
                ? houseDetailHref(house, user, "payments")
                : role === "locataire"
                  ? housePublicHref(payment.houseId)
                  : houseManagerHref(payment.houseId, "payments");
              return (
                <tr key={payment.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-bold">{payment.houseTitle || contract?.seal || payment.houseId}</td>
                  <td className="px-3 py-3">{payment.occupantName}</td>
                  <td className="px-3 py-3">{payment.period}</td>
                  <td className="px-3 py-3 font-black">{money(payment.amount)}</td>
                  <td className="px-3 py-3">{formatPaymentDate(payment.paidAt)}</td>
                  <td className="px-3 py-3"><Badge>{payment.method}</Badge></td>
                  <td className="px-3 py-3"><Link href={href} className="text-xs font-bold text-brand-700">Voir le bien</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!payments.length && <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-muted">Aucun paiement enregistré pour le moment.</p>}
      </div>
      {role !== "locataire" && Boolean(contracts.length) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {contracts.slice(0, 4).map(contract => (
            <Link key={contract.id} href={houseManagerHref(contract.houseId, "payments")} className="inline-flex rounded-full bg-brand-50 px-4 py-2 text-xs font-black text-brand-700">
              Enregistrer pour {contract.tenant}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function PropertiesView({ role, houses, user }: { role: Exclude<Role, "admin">; houses: House[]; user: { id: string; role: Role } }) {
  return (
    <div className="space-y-3">
      <div className="surface-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">{role === "locataire" ? "Recherche et favoris" : "Possessions"}</h2>
            <p className="mt-1 text-sm text-muted">{role === "locataire" ? "Biens disponibles a surveiller ou visiter." : "Clique sur une possession pour ouvrir sa page detail et lancer les actions rapides."}</p>
          </div>
          {role !== "locataire" && (
            <Link href="/add-house" className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-black text-white">
              <PlusCircle size={16} /> Publier un bien
            </Link>
          )}
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {houses.map(house => (
          <div key={house.id} className={`surface-card relative ${role !== "locataire" ? "transition hover:-translate-y-0.5 hover:shadow-soft" : ""}`}>
            <Link
              href={houseDetailHref(house, user)}
              aria-label={`Ouvrir le detail de ${house.title}`}
              className="absolute inset-0 z-10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-4"
            >
              <span className="sr-only">Ouvrir le detail</span>
            </Link>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-black">{house.title}</h3>
                <p className="text-sm text-muted">{house.commune}, {house.city}</p>
              </div>
              <Badge tone={house.status === "Disponible" ? "success" : "warn"}>{house.status}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div className="soft-tile"><p className="text-muted">Loyer</p><p className="font-black">{money(house.price)}</p></div>
              <div className="soft-tile"><p className="text-muted">Pièces</p><p className="font-black">{house.rooms}</p></div>
              <div className="soft-tile"><p className="text-muted">Type</p><p className="font-black">{house.type}</p></div>
            </div>
            {role !== "locataire" && (
              <div className="mt-3 soft-tile text-sm">
                <p className="text-muted">Occupant</p>
                <p className="font-black">{house.currentTenant || "Aucun occupant actif"}</p>
              </div>
            )}
            <p className="mt-4 inline-flex rounded-full bg-brand-50 px-4 py-2 text-xs font-black text-brand-700">
              {role === "locataire" ? "Voir details" : "Ouvrir le detail"}
            </p>
          </div>
        ))}
        {!houses.length && <p className="rounded-2xl bg-white p-5 text-sm font-semibold text-muted shadow-card">Aucun bien à afficher pour cette vue.</p>}
      </div>
    </div>
  );
}

function ContractsView({ role, contracts, houses, user }: { role: Exclude<Role, "admin">; contracts: Contract[]; houses: House[]; user: { id: string; role: Role } }) {
  const houseById = new globalThis.Map(houses.map(house => [house.id, house]));

  return (
    <div className="surface-card">
      <h2 className="text-xl font-black">{role === "locataire" ? "Mes contrats" : "Contrats et locataires"}</h2>
      <div className="mt-4 grid gap-3">
        {contracts.map(contract => (
          <div key={contract.id} className="grid gap-3 soft-panel md:grid-cols-[1fr_220px] md:items-center">
            <div>
              <p className="font-black">{contract.seal}</p>
              <p className="text-sm text-muted">{contract.owner} / {contract.tenant}</p>
              <p className="mt-1 text-xs text-muted">Début {contract.startDate} - {contract.duration}</p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Badge>{contract.status}</Badge>
              <Link
                href={houseById.has(contract.houseId) ? houseContractHref(houseById.get(contract.houseId)!, user) : role === "locataire" ? houseContractsHref(contract.houseId) : houseManagerHref(contract.houseId, "contract")}
                className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-700"
              >
                {role === "locataire" ? "Ouvrir contrat" : "Modifier contrat"}
              </Link>
              <Badge tone={contract.agreedByOwnerAt && contract.agreedByTenantAt ? "success" : "warn"}>{contract.agreedByOwnerAt && contract.agreedByTenantAt ? "Accord validé" : "Accord en attente"}</Badge>
            </div>
          </div>
        ))}
        {!contracts.length && <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-muted">Aucun contrat pour le moment.</p>}
      </div>
    </div>
  );
}

function MessagesView({ role, contracts }: { role: Exclude<Role, "admin">; contracts: Contract[] }) {
  const [selectedContractId, setSelectedContractId] = useState<string | null>(contracts[0]?.id || null);
  const selectedContract = contracts.find(contract => contract.id === selectedContractId) || contracts[0] || null;

  useEffect(() => {
    if (!contracts.length) {
      setSelectedContractId(null);
      return;
    }
    if (!selectedContractId || !contracts.some(contract => contract.id === selectedContractId)) {
      setSelectedContractId(contracts[0].id);
    }
  }, [contracts, selectedContractId]);

  const recipientId = selectedContract
    ? role === "locataire"
      ? selectedContract.ownerId
      : selectedContract.tenantId
    : undefined;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-xl font-black">Messagerie</h2>
          <p className="mt-1 text-sm text-muted">{role === "locataire" ? "Conversations avec les bailleurs." : "Conversations avec les locataires par bien."}</p>
        </div>
        <Badge>{contracts.length} conversation(s)</Badge>
      </div>
      <div className="grid min-h-[420px] xl:grid-cols-[320px_1fr]">
        <div className="border-b border-slate-100 bg-white p-3 xl:border-b-0 xl:border-r">
          <div className="mb-3 px-2">
            <p className="text-xs font-black uppercase text-muted">Conversations</p>
          </div>
          <div className="grid max-h-[calc(100vh-260px)] content-start gap-1 overflow-y-auto scrollbar-soft">
          {contracts.map(contract => {
            const active = selectedContract?.id === contract.id;
            const name = role === "locataire" ? contract.owner : contract.tenant;
            return (
              <button key={contract.id} onClick={() => setSelectedContractId(contract.id)} className={`flex items-center gap-3 rounded-2xl p-3 text-left transition ${active ? "bg-brand-50" : "hover:bg-slate-50"}`}>
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-black ${active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                  {initials(name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black text-slate-950">{name}</span>
                  <span className="block truncate text-sm font-semibold text-muted">Conversation liée à {contract.seal}</span>
                  <span className="mt-1 flex items-center gap-2 text-xs font-bold text-brand-700">
                    {active ? "Conversation ouverte" : "Ouvrir la discussion"}
                  </span>
                </span>
              </button>
            );
          })}
          {!contracts.length && <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-muted">Aucune conversation disponible pour le moment.</p>}
          </div>
        </div>

        {selectedContract ? (
          <div className="min-w-0 bg-slate-50 p-3">
            <InternalMessageThread
              key={`${selectedContract.houseId}-${recipientId || "none"}`}
              houseId={selectedContract.houseId}
              recipientId={recipientId}
              title={role === "locataire" ? selectedContract.owner : selectedContract.tenant}
              subtitle={`Contrat ${selectedContract.seal}`}
              emptyText={recipientId ? "Aucun message dans cette conversation." : "Aucun interlocuteur disponible pour cette conversation."}
            />
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-muted">Selectionne une conversation pour afficher les messages.</div>
        )}
      </div>
    </div>
  );
}

export function UserDashboard({ data }: { data: AppData }) {
  const { user } = useCurrentUser();
  const [dashboardData, setDashboardData] = useState<AppData>(data);
  const [section, setSection] = useState<UserSection>("overview");
  const role = user?.role && user.role !== "admin" ? user.role : null;
  const meta = role ? roleMeta[role] : null;

  useEffect(() => {
    const syncSectionFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const nextSection = params.get("section");
      if (isUserSection(nextSection)) setSection(nextSection);
      if (!nextSection) setSection("overview");
    };

    syncSectionFromUrl();
    window.addEventListener("popstate", syncSectionFromUrl);
    return () => window.removeEventListener("popstate", syncSectionFromUrl);
  }, []);

  useEffect(() => {
    async function refreshDashboard() {
      if (!user || user.role === "admin") return;
      const token = await getSupabaseAccessToken();
      if (!token) return;

      const res = await fetch("/api/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      if (!res.ok) return;
      const body = (await res.json()) as AppData;
      setDashboardData(body);
    }

    refreshDashboard();
  }, [user]);

  const scoped = useMemo(() => role ? filterData(dashboardData, role, user?.id) : { houses: [], contracts: [], payments: [] }, [dashboardData, role, user?.id]);
  const quickActions: Array<{ label: string; section: UserSection }> = role === "locataire"
    ? [
        { label: "Voir mes paiements", section: "payments" },
        { label: "Chercher un bien", section: "properties" },
        { label: "Ouvrir mes contrats", section: "contracts" },
        { label: "Lire mes messages", section: "messages" }
      ]
    : [
        { label: "Suivre les paiements", section: "payments" },
        { label: "Voir mes possessions", section: "properties" },
        { label: "Verifier les contrats", section: "contracts" },
        { label: "Repondre aux messages", section: "messages" }
      ];

  function selectSection(nextSection: UserSection) {
    setSection(nextSection);
    const url = new URL(window.location.href);
    if (nextSection === "overview") {
      url.searchParams.delete("section");
    } else {
      url.searchParams.set("section", nextSection);
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  if (!user || !role || !meta) return null;

  return (
    <section className="rounded-2xl bg-slate-100 p-2 md:p-3 lg:h-[calc(100vh-104px)] lg:overflow-hidden">
      <div className="grid gap-3 lg:h-full lg:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl bg-ink p-4 text-white lg:h-full lg:overflow-y-auto lg:overscroll-contain scrollbar-soft">
          <div>
            <p className="text-xs font-bold uppercase text-white/50">{meta.label}</p>
            <h2 className="mt-1 text-xl font-black">{meta.title}</h2>
            <p className="mt-2 text-xs leading-5 text-white/50">{user.fullName}</p>
          </div>
          <nav className="mt-6 grid gap-2">
            {meta.nav.map(({ id, label, description, Icon }) => (
              <button key={id} onClick={() => selectSection(id)} className={`flex items-center gap-3 rounded-2xl p-3 text-left transition ${section === id ? "bg-white text-ink" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${section === id ? "bg-brand-50 text-brand-700" : "bg-white/10"}`}><Icon size={18} /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-black">{label}</span>
                  <span className={`block text-xs ${section === id ? "text-slate-500" : "text-white/45"}`}>{description}</span>
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 rounded-2xl bg-slate-50 p-2 md:p-3 lg:h-full lg:overflow-y-auto lg:overscroll-contain scrollbar-soft">
          {section === "overview" && (
            <div className="space-y-3">
              <SummaryCards role={role} houses={scoped.houses} contracts={scoped.contracts} payments={scoped.payments} />
              <div className="grid gap-3 xl:grid-cols-2">
                <PaymentsView role={role} contracts={scoped.contracts.slice(0, 5)} payments={scoped.payments.slice(0, 5)} houses={scoped.houses} user={user} />
                <div className="surface-card">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="text-brand-600" size={20} />
                    <h2 className="text-xl font-black">Prochaines actions</h2>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm">
                    {quickActions.map(action => (
                      <button key={action.section} onClick={() => selectSection(action.section)} className="soft-tile text-left font-semibold transition hover:bg-brand-50 hover:text-brand-700">
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {section === "payments" && <PaymentsView role={role} contracts={scoped.contracts} payments={scoped.payments} houses={scoped.houses} user={user} />}
          {section === "properties" && <PropertiesView role={role} houses={scoped.houses} user={user} />}
          {section === "contracts" && <ContractsView role={role} contracts={scoped.contracts} houses={scoped.houses} user={user} />}
          {section === "messages" && <MessagesView role={role} contracts={scoped.contracts} />}
          {section === "map" && <DashboardMap houses={scoped.houses} title="Vue map" subtitle={role === "locataire" ? "Biens disponibles à proximité de tes recherches." : "Répartition géographique de ton portefeuille."} />}
        </div>
      </div>
    </section>
  );
}
