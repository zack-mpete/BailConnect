"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Building2, CalendarClock, ClipboardList, FileSignature, Home, Map, MessageSquare, PlusCircle, Search, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui";
import { DashboardMap } from "@/components/dashboard-map";
import { InternalMessageThread } from "@/components/internal-message-thread";
import { RentalRequestsPanel } from "@/components/rental-requests-panel";
import { useCurrentUser } from "@/lib/auth-client";
import { houseContractHref, houseContractsHref, houseDetailHref, houseManagerHref, housePublicHref } from "@/lib/house-links";
import { getSupabaseAccessToken } from "@/lib/supabase";
import { money } from "@/lib/utils";
import { CONTRACT_STATUS_LABELS } from "@/lib/statuses";
import type { AppData, Contract, House, Payment, Role } from "@/types";

type UserSection = "overview" | "payments" | "properties" | "requests" | "contracts" | "messages" | "map";

const userSections: UserSection[] = ["overview", "payments", "properties", "requests", "contracts", "messages", "map"];

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
      { id: "requests", label: "Demandes", description: "Candidatures reçues", Icon: ClipboardList },
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
      { id: "requests", label: "Demandes", description: "Candidatures reçues", Icon: ClipboardList },
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
      { id: "requests", label: "Mes demandes", description: "Décisions des bailleurs", Icon: ClipboardList },
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
  const palette = [
    { card: "from-cyan-50 to-white border-cyan-100", icon: "bg-cyan-100 text-cyan-700" },
    { card: "from-violet-50 to-white border-violet-100", icon: "bg-violet-100 text-violet-700" },
    { card: "from-emerald-50 to-white border-emerald-100", icon: "bg-emerald-100 text-emerald-700" },
    { card: "from-amber-50 to-white border-amber-100", icon: "bg-amber-100 text-amber-700" }
  ];
  const occupancyPercentage = houses.length ? Math.round(((houses.length - available) / houses.length) * 100) : 0;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, Icon }, index) => (
        <div key={label} className={`rounded-2xl border bg-gradient-to-br p-4 shadow-card ${palette[index].card}`}>
          <span className={`icon-chip ${palette[index].icon}`}><Icon size={19} /></span>
          <p className="mt-3 text-2xl font-black tracking-tight">{value}</p>
          <p className="text-sm font-semibold text-muted">{label}</p>
        </div>
      ))}
      {role !== "locataire" && (
        <div className="rounded-2xl border border-cyan-100 bg-white p-4 shadow-card md:col-span-2 xl:col-span-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge tone="success">{available} disponibles</Badge>
              <Badge>{Math.max(houses.length - available, 0)} occupés/réservés</Badge>
              <Badge tone="success">{paidThisMonth} paiement(s) ce mois</Badge>
            </div>
            <p className="text-xs font-black text-cyan-800">Occupation {occupancyPercentage}%</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500" style={{ width: `${occupancyPercentage}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardWelcome({
  role,
  fullName,
  houses,
  contracts
}: {
  role: Exclude<Role, "admin">;
  fullName: string;
  houses: House[];
  contracts: Contract[];
}) {
  const roleLabel = role === "locataire" ? "Espace locataire" : role === "agence" ? "Pilotage agence" : "Pilotage bailleur";
  const description = role === "locataire"
    ? "Retrouve tes demandes, contrats, paiements et conversations dans un espace unique."
    : "Suis ton portefeuille, les demandes locatives et les contrats depuis une vue opérationnelle.";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-cyan-950 to-brand-900 p-5 text-white shadow-soft">
      <div className="absolute -right-8 -top-16 h-44 w-44 rounded-full bg-cyan-300/15 blur-2xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">{roleLabel}</p>
          <h1 className="mt-2 text-2xl font-black">Bonjour, {fullName}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-black">
          <span className="rounded-full bg-white/10 px-3 py-2">{houses.length} bien(s)</span>
          <span className="rounded-full bg-cyan-300/15 px-3 py-2 text-cyan-100">{contracts.length} contrat(s)</span>
        </div>
      </div>
    </div>
  );
}

function PaymentsView({ role, contracts, payments, houses, user }: { role: Exclude<Role, "admin">; contracts: Contract[]; payments: Payment[]; houses: House[]; user: { id: string; role: Role } }) {
  const contractByHouse = new globalThis.Map(contracts.map(contract => [contract.houseId, contract]));
  const houseById = new globalThis.Map(houses.map(house => [house.id, house]));
  const paymentHref = (payment: Payment) => {
    const house = houseById.get(payment.houseId);
    return house
      ? houseDetailHref(house, user, "payments")
      : role === "locataire"
        ? housePublicHref(payment.houseId)
        : houseManagerHref(payment.houseId, "payments");
  };

  return (
    <div className="surface-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">{role === "locataire" ? "Mes paiements" : "Paiements des locataires"}</h2>
          <p className="mt-1 text-sm text-muted">Paiements réellement enregistrés sur les propriétés et occupants liés.</p>
        </div>
        <Badge>{payments.length} paiement(s)</Badge>
      </div>
      <div className="mt-4 grid gap-3 md:hidden">
        {payments.map(payment => {
          const contract = contractByHouse.get(payment.houseId);
          return (
            <article key={payment.id} className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-black">{payment.houseTitle || contract?.seal || payment.houseId}</p>
                  <p className="mt-1 truncate text-sm text-muted">{payment.occupantName}</p>
                </div>
                <Badge>{payment.method}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs font-bold text-muted">Montant</p>
                  <p className="mt-1 break-words font-black">{money(payment.amount)}</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs font-bold text-muted">Période</p>
                  <p className="mt-1 break-words font-black">{payment.period}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between">
                <p className="text-xs font-semibold text-muted">{formatPaymentDate(payment.paidAt)}</p>
                <Link href={paymentHref(payment)} className="inline-flex justify-center rounded-full bg-brand-50 px-4 py-2 text-xs font-black text-brand-700">
                  Voir le bien
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      <div className="mt-4 hidden overflow-x-auto md:block">
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
              return (
                <tr key={payment.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-bold">{payment.houseTitle || contract?.seal || payment.houseId}</td>
                  <td className="px-3 py-3">{payment.occupantName}</td>
                  <td className="px-3 py-3">{payment.period}</td>
                  <td className="px-3 py-3 font-black">{money(payment.amount)}</td>
                  <td className="px-3 py-3">{formatPaymentDate(payment.paidAt)}</td>
                  <td className="px-3 py-3"><Badge>{payment.method}</Badge></td>
                  <td className="px-3 py-3"><Link href={paymentHref(payment)} className="text-xs font-bold text-brand-700">Voir le bien</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!payments.length && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-muted">Aucun paiement enregistré pour le moment.</p>}
      {role !== "locataire" && Boolean(contracts.length) && (
        <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
          {contracts.slice(0, 4).map(contract => (
            <Link key={contract.id} href={houseManagerHref(contract.houseId, "payments")} className="inline-flex justify-center rounded-full bg-brand-50 px-4 py-2 text-center text-xs font-black text-brand-700">
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
            <div className="mt-4 grid gap-2 text-sm min-[360px]:grid-cols-3">
              <div className="soft-tile min-w-0"><p className="text-muted">Loyer</p><p className="break-words font-black">{money(house.price)}</p></div>
              <div className="soft-tile"><p className="text-muted">Pièces</p><p className="font-black">{house.rooms}</p></div>
              <div className="soft-tile min-w-0"><p className="text-muted">Type</p><p className="break-words font-black">{house.type}</p></div>
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

function ContractsView({ role, contracts, houses }: { role: Exclude<Role, "admin">; contracts: Contract[]; houses: House[] }) {
  const houseById = new globalThis.Map(houses.map(house => [house.id, house]));

  return (
    <div className="surface-card">
      <h2 className="text-xl font-black">{role === "locataire" ? "Mes contrats" : "Contrats et locataires"}</h2>
      <div className="mt-4 grid gap-3">
        {contracts.map(contract => (
          <div key={contract.id} className="grid min-w-0 gap-3 soft-panel md:grid-cols-[1fr_220px] md:items-center">
            <div className="min-w-0">
              <p className="break-words font-black">{contract.seal}</p>
              <p className="break-words text-sm text-muted">{contract.owner} / {contract.tenant}</p>
              <p className="mt-1 text-xs text-muted">Début {contract.startDate} - {contract.duration}</p>
            </div>
            <div className="flex min-w-0 flex-col items-start gap-2 min-[390px]:flex-row min-[390px]:flex-wrap md:justify-end">
              <Badge>{CONTRACT_STATUS_LABELS[contract.status]}</Badge>
              <Link
                href={houseById.has(contract.houseId)
                  ? houseContractHref(houseById.get(contract.houseId)!)
                  : houseContractsHref(contract.houseId)}
                className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-700"
              >
                Ouvrir le contrat
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
      <div className="grid min-h-0 xl:min-h-[420px] xl:grid-cols-[320px_1fr]">
        <div className="border-b border-slate-100 bg-white p-3 xl:border-b-0 xl:border-r">
          <div className="mb-3 px-2">
            <p className="text-xs font-black uppercase text-muted">Conversations</p>
          </div>
          <div className="flex snap-x gap-2 overflow-x-auto pb-1 scrollbar-soft xl:grid xl:max-h-[calc(100dvh-260px)] xl:content-start xl:gap-1 xl:overflow-x-visible xl:overflow-y-auto xl:pb-0">
          {contracts.map(contract => {
            const active = selectedContract?.id === contract.id;
            const name = role === "locataire" ? contract.owner : contract.tenant;
            return (
              <button key={contract.id} onClick={() => setSelectedContractId(contract.id)} className={`flex min-w-[240px] snap-start items-center gap-3 rounded-2xl p-3 text-left transition xl:min-w-0 ${active ? "bg-brand-50" : "bg-slate-50 hover:bg-slate-100 xl:bg-transparent"}`}>
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

  const refreshDashboard = useCallback(async () => {
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
  }, [user]);

  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  const scoped = useMemo(() => role ? filterData(dashboardData, role, user?.id) : { houses: [], contracts: [], payments: [] }, [dashboardData, role, user?.id]);
  const quickActions: Array<{ label: string; section: UserSection }> = role === "locataire"
    ? [
        { label: "Voir mes paiements", section: "payments" },
        { label: "Chercher un bien", section: "properties" },
        { label: "Suivre mes demandes", section: "requests" },
        { label: "Ouvrir mes contrats", section: "contracts" },
        { label: "Lire mes messages", section: "messages" }
      ]
    : [
        { label: "Suivre les paiements", section: "payments" },
        { label: "Voir mes possessions", section: "properties" },
        { label: "Traiter les demandes", section: "requests" },
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
    <section className="min-w-0 rounded-2xl bg-gradient-to-br from-slate-100 via-cyan-50/60 to-white p-1.5 min-[360px]:p-2 md:p-3 lg:h-[calc(100dvh-104px)] lg:overflow-hidden">
      <div className="grid gap-3 lg:h-full lg:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-cyan-950 p-4 text-white shadow-soft lg:h-full lg:overflow-y-auto lg:overscroll-contain scrollbar-soft">
          <div>
            <p className="text-xs font-bold uppercase text-white/50">{meta.label}</p>
            <h2 className="mt-1 text-xl font-black">{meta.title}</h2>
            <p className="mt-2 text-xs leading-5 text-white/50">{user.fullName}</p>
          </div>
          <nav className="mt-6 flex snap-x gap-2 overflow-x-auto pb-2 scrollbar-soft lg:grid lg:overflow-visible lg:pb-0">
            {meta.nav.map(({ id, label, description, Icon }) => (
              <button key={id} type="button" aria-pressed={section === id} onClick={() => selectSection(id)} className={`flex min-w-[172px] snap-start items-center gap-3 rounded-2xl p-3 text-left transition min-[390px]:min-w-[190px] lg:min-w-0 ${section === id ? "bg-white text-ink shadow-card" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${section === id ? "bg-brand-50 text-brand-700" : "bg-white/10"}`}><Icon size={18} /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-black">{label}</span>
                  <span className={`block text-xs ${section === id ? "text-slate-500" : "text-white/45"}`}>{description}</span>
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 rounded-2xl bg-white/70 p-2 shadow-inner backdrop-blur-sm md:p-3 lg:h-full lg:overflow-y-auto lg:overscroll-contain scrollbar-soft">
          {section === "overview" && (
            <div className="space-y-3 animate-[fadeIn_.2s_ease-out]">
              <DashboardWelcome role={role} fullName={user.fullName} houses={scoped.houses} contracts={scoped.contracts} />
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
          {section !== "overview" && (
            <div key={section} className="animate-[fadeIn_.2s_ease-out]">
              {section === "payments" && <PaymentsView role={role} contracts={scoped.contracts} payments={scoped.payments} houses={scoped.houses} user={user} />}
              {section === "properties" && <PropertiesView role={role} houses={scoped.houses} user={user} />}
              {section === "requests" && <RentalRequestsPanel role={role} requests={dashboardData.rentalRequests} onChanged={refreshDashboard} />}
              {section === "contracts" && <ContractsView role={role} contracts={scoped.contracts} houses={scoped.houses} />}
              {section === "messages" && <MessagesView role={role} contracts={scoped.contracts} />}
              {section === "map" && <DashboardMap houses={scoped.houses} title="Vue map" subtitle={role === "locataire" ? "Biens disponibles à proximité de tes recherches." : "Répartition géographique de ton portefeuille."} />}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
