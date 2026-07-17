"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileSignature, Home, MessageSquare, UserRound, WalletCards } from "lucide-react";
import { Button } from "@/components/ui";
import { InternalMessageThread } from "@/components/internal-message-thread";
import { OwnerContractEditor } from "@/components/owner-house/owner-contract-editor";
import { OwnerHouseSummary } from "@/components/owner-house/owner-house-summary";
import { OwnerPaymentPanel } from "@/components/owner-house/owner-payment-panel";
import { useCurrentUser } from "@/lib/auth-client";
import { houseContractHref, housePublicHref } from "@/lib/house-links";
import { getSupabaseAccessToken } from "@/lib/supabase";
import type { AppData, Contract, House, Payment } from "@/types";

type OwnerHouseWorkspaceProps = {
  houseId: string;
  house: House | null;
  contracts: Contract[];
  payments: Payment[];
};

type DetailAction = "payment" | "contract" | "message" | null;

export function OwnerHouseWorkspace({ houseId, house, contracts, payments }: OwnerHouseWorkspaceProps) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [managedHouse, setManagedHouse] = useState<House | null>(house);
  const [managedContracts, setManagedContracts] = useState(contracts);
  const [managedPayments, setManagedPayments] = useState(payments);
  const [detailsLoading, setDetailsLoading] = useState(!house);
  const [activeAction, setActiveAction] = useState<DetailAction>(null);

  const activeContract = useMemo(
    () => managedContracts.find(contract => contract.status !== "annule") || managedContracts[0] || null,
    [managedContracts]
  );
  const tenantId = activeContract?.tenantId || managedHouse?.currentTenantId || null;
  const activeOccupantName = activeContract?.tenant || managedHouse?.currentTenant || null;
  const canManage = Boolean(managedHouse && (user?.role === "admin" || user?.id === managedHouse.ownerId));

  useEffect(() => {
    if (!loading && !detailsLoading && managedHouse && !canManage) {
      router.replace(housePublicHref(managedHouse.id));
    }
  }, [canManage, detailsLoading, loading, managedHouse, router]);

  useEffect(() => {
    setManagedHouse(house);
    setManagedContracts(contracts);
    setManagedPayments(payments);
    setDetailsLoading(!house);
  }, [contracts, house, payments]);

  useEffect(() => {
    async function refreshDetails() {
      if (!user) {
        setDetailsLoading(false);
        return;
      }

      const token = await getSupabaseAccessToken();
      if (!token) {
        setDetailsLoading(false);
        return;
      }

      setDetailsLoading(true);
      const res = await fetch("/api/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      if (!res.ok) {
        setDetailsLoading(false);
        return;
      }

      const body = (await res.json()) as AppData;
      const nextHouse = body.houses.find(item => item.id === houseId) || null;
      if (!nextHouse) {
        setManagedHouse(null);
        setManagedContracts([]);
        setManagedPayments([]);
        setDetailsLoading(false);
        return;
      }

      setManagedHouse(nextHouse);
      setManagedContracts(body.contracts.filter(contract => contract.houseId === houseId));
      setManagedPayments(body.payments.filter(payment => payment.houseId === houseId));
      setDetailsLoading(false);
    }

    refreshDetails();
  }, [houseId, user]);

  useEffect(() => {
    function syncActionFromHash() {
      if (window.location.hash === "#paiements") {
        setActiveAction("payment");
        return;
      }
      if (window.location.hash === "#modifier-contrat") {
        setActiveAction("contract");
        return;
      }
      if (window.location.hash === "#contacter-locataire") {
        setActiveAction("message");
        return;
      }
      setActiveAction(null);
    }

    syncActionFromHash();
    window.addEventListener("hashchange", syncActionFromHash);
    return () => window.removeEventListener("hashchange", syncActionFromHash);
  }, []);

  function selectAction(action: Exclude<DetailAction, null>) {
    const actionTarget = {
      payment: { hash: "#paiements", targetId: "paiements" },
      contract: { hash: "#modifier-contrat", targetId: "modifier-contrat" },
      message: { hash: "#contacter-locataire", targetId: "contacter-locataire" }
    }[action];

    setActiveAction(action);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${actionTarget.hash}`);
    window.requestAnimationFrame(() => {
      document.getElementById(actionTarget.targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (loading || detailsLoading) {
    return <div className="rounded-2xl bg-white p-5 text-sm font-semibold text-muted shadow-card">Chargement...</div>;
  }

  if (!managedHouse) {
    return (
      <div className="surface-card">
        <h1 className="text-2xl font-black">Bien introuvable</h1>
        <p className="mt-2 text-sm text-muted">Ce bien n'est pas disponible dans ton espace ou n'existe plus.</p>
        <Button href="/dashboard" className="mt-4 bg-ink text-white">Retour dashboard</Button>
      </div>
    );
  }

  if (!user || !canManage) {
    return (
      <div className="surface-card">
        <h1 className="text-2xl font-black">Redirection vers l’annonce</h1>
        <p className="mt-2 text-sm text-muted">Cet espace de gestion est réservé au responsable du bien.</p>
        <Button href={housePublicHref(managedHouse.id)} className="mt-4 bg-ink text-white">Voir l’annonce</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-brand-700">
        <ArrowLeft size={16} /> Retour dashboard
      </Link>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <section className="space-y-5">
          <OwnerHouseSummary house={managedHouse} contracts={managedContracts} />

          <div className="surface-card">
            <div className="flex items-center gap-2">
              <UserRound className="text-brand-600" size={20} />
              <h2 className="text-xl font-black">Locataire et occupation</h2>
            </div>

            {activeOccupantName ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="soft-panel">
                  <p className="text-sm font-bold text-muted">Locataire</p>
                  <p className="mt-1 text-lg font-black">{activeOccupantName}</p>
                </div>
                <div className="soft-panel">
                  <p className="text-sm font-bold text-muted">Contrat</p>
                  <p className="mt-1 font-black">{activeContract?.seal || managedHouse.currentContractId || "Contrat courant"}</p>
                  <p className="mt-1 text-xs font-semibold text-muted">
                    {activeContract ? `${activeContract.status} - ${activeContract.duration}` : "Occupant courant enregistre sur le bien"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 soft-panel text-sm font-semibold text-muted">Aucun locataire ou contrat lie a cette maison pour le moment.</p>
            )}
          </div>

          <div id="actions-rapides" className="scroll-mt-24">
            {!activeAction && (
              <div className="surface-card border-dashed border-slate-200">
                <h2 className="text-xl font-black">Actions rapides</h2>
                <p className="mt-2 text-sm text-muted">
                  Choisis une action dans le panneau de droite pour afficher le formulaire correspondant.
                </p>
              </div>
            )}

            {activeAction === "payment" && (
              <OwnerPaymentPanel
                activeContract={activeContract}
                house={managedHouse}
                payments={managedPayments}
                onPaymentCreated={payment => setManagedPayments(current => [payment, ...current])}
              />
            )}

            {activeAction === "contract" && (
              <OwnerContractEditor house={managedHouse} onHouseUpdated={setManagedHouse} />
            )}

            {activeAction === "message" && (
              <div id="contacter-locataire" className="scroll-mt-24">
                <InternalMessageThread
                  houseId={managedHouse.id}
                  recipientId={tenantId}
                  title={activeContract ? `Conversation avec ${activeContract.tenant}` : "Contacter le locataire"}
                  subtitle={activeContract ? `Contrat ${activeContract.seal}` : undefined}
                  emptyText={tenantId ? "Aucun message avec ce locataire." : "Aucun locataire actif a contacter pour ce bien."}
                />
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-2xl bg-ink p-5 text-white shadow-card">
            <Home size={22} />
            <h2 className="mt-4 text-xl font-black">Operations rapides</h2>
            <div className="mt-4 grid gap-2 text-sm">
              <Link href={housePublicHref(managedHouse.id)} className="rounded-xl bg-white/10 p-3 font-bold hover:bg-white/15">Voir l'annonce publique</Link>
              <Link href={houseContractHref(managedHouse, user)} className="rounded-xl bg-white/10 p-3 font-bold hover:bg-white/15">Ouvrir le contrat</Link>
              <button
                type="button"
                onClick={() => selectAction("payment")}
                className={`flex items-center gap-2 rounded-xl p-3 text-left font-bold hover:bg-white/15 ${activeAction === "payment" ? "bg-white text-ink" : "bg-white/10"}`}
              >
                <WalletCards size={16} /> Enregistrer un paiement
              </button>
              <button
                type="button"
                onClick={() => selectAction("contract")}
                className={`flex items-center gap-2 rounded-xl p-3 text-left font-bold hover:bg-white/15 ${activeAction === "contract" ? "bg-white text-ink" : "bg-white/10"}`}
              >
                <FileSignature size={16} /> Modifier le contrat
              </button>
              <button
                type="button"
                onClick={() => selectAction("message")}
                className={`flex items-center gap-2 rounded-xl p-3 text-left font-bold hover:bg-white/15 ${activeAction === "message" ? "bg-white text-ink" : "bg-white/10"}`}
              >
                <MessageSquare size={16} /> Contacter le locataire
              </button>
              <Link href="/add-house" className="rounded-xl bg-white/10 p-3 font-bold hover:bg-white/15">Publier un autre bien</Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
