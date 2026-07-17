"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Edit3, MessageCircle, Printer, RotateCcw, Save } from "lucide-react";
import toast from "react-hot-toast";
import { InternalMessageThread } from "@/components/internal-message-thread";
import type { AppData, Contract, House } from "@/types";
import { useCurrentUser } from "@/lib/auth-client";
import { getSupabaseAccessToken, supabase } from "@/lib/supabase";
import { money } from "@/lib/utils";

type ContractWorkspaceProps = {
  requestedHouseId?: string | null;
  house: House | null;
  contract?: Contract | null;
};

type SidebarPanel = "actions" | "messages";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function editableClass(canEdit: boolean) {
  return canEdit
    ? "cursor-text rounded-xl outline-none transition hover:bg-brand-50/50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:ring-offset-4 focus:ring-offset-white"
    : "";
}

function pastePlainText(event: ClipboardEvent<HTMLElement>) {
  event.preventDefault();
  const text = event.clipboardData.getData("text/plain");
  document.execCommand("insertText", false, text);
}

export function ContractWorkspace({ requestedHouseId, house, contract }: ContractWorkspaceProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useCurrentUser();
  const [editableHouse, setEditableHouse] = useState<House | null>(house);
  const [contractState, setContractState] = useState<Contract | null>(contract || null);
  const [houseLoading, setHouseLoading] = useState(Boolean(requestedHouseId && house?.id !== requestedHouseId));
  const [editorTitle, setEditorTitle] = useState("");
  const [editorBody, setEditorBody] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [editorDirty, setEditorDirty] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>("actions");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const landlordName = contractState?.owner || editableHouse?.owner || "[NOM DU BAILLEUR]";
  const tenantName = contractState?.tenant || user?.fullName || "[NOM DU LOCATAIRE]";
  const rentAmount = contractState ? money(contractState.rent) : editableHouse ? money(editableHouse.price) : "[MONTANT DU LOYER]";
  const contractDuration = contractState?.duration || `${editableHouse?.contractDurationMonths || 12} mois`;
  const depositAmount = editableHouse?.contractDeposit ? money(editableHouse.contractDeposit) : null;
  const paymentTerms = editableHouse?.contractPaymentTerms?.trim();
  const specialTerms = editableHouse?.contractSpecialTerms?.trim();
  const defaultTitle = "Contrat de bail a usage d'habitation";
  const agreementDate = contractState?.startDate || "[DATE D'ACCORD]";
  const tenantAgreed = Boolean(contractState?.agreedByTenantAt);
  const landlordAgreed = Boolean(contractState?.agreedByOwnerAt);
  const isOwner = Boolean(user?.id && editableHouse?.ownerId && user.id === editableHouse.ownerId);
  const canEditContract = Boolean(user && editableHouse && (isOwner || user.role === "admin"));
  const isLandlord = isOwner;
  const currentParty = isLandlord ? "bailleur" : "locataire";
  const messageRecipientId = isLandlord ? contractState?.tenantId : editableHouse?.ownerId;
  const canMarkAgreement = Boolean(
    user &&
    (
      contractState
        ? !(isLandlord ? landlordAgreed : tenantAgreed)
        : editableHouse && !isLandlord
    )
  );
  const agreementComplete = landlordAgreed && tenantAgreed;
  const statusLabel = agreementComplete ? "Valide" : contractState ? "En attente" : "A initialiser";

  const defaultBody = useMemo(() => {
    const location = editableHouse ? `${editableHouse.commune}, ${editableHouse.city}` : "[LOCALISATION DU BIEN]";
    const houseTitle = editableHouse?.title || "[BIEN CONCERNE]";

    return [
      "Entre les soussignes :",
      `Monsieur/Madame ${landlordName}, ci-apres designe(e) le Bailleur,`,
      "Et",
      `Monsieur/Madame ${tenantName}, ci-apres designe(e) le Locataire,`,
      "",
      "Il a ete convenu ce qui suit :",
      "Le Bailleur met a la disposition du Locataire un bien immobilier a usage d'habitation, conformement aux informations enregistrees dans la plateforme.",
      `Bien concerne : ${houseTitle}, situe a ${location}.`,
      `Le present contrat est conclu pour une duree de ${contractDuration}, a compter de la date d'accord enregistree dans la plateforme.`,
      `Le montant du loyer est fixe a ${rentAmount}.`,
      "Le Locataire s'engage a payer le loyer convenu selon les modalites acceptees entre les deux parties, a maintenir le bien en bon etat et a signaler au Bailleur tout probleme important lie au logement.",
      "Le Bailleur s'engage a mettre le logement a la disposition du Locataire dans un etat conforme a son usage, a respecter les informations publiees et a garantir une occupation paisible du logement.",
      "Le Locataire ne peut pas sous-louer le logement sans autorisation prealable du Bailleur.",
      "Le present contrat peut etre renouvele a son expiration par accord entre le Bailleur et le Locataire.",
      "Le present contrat peut etre resilie en cas de non-respect des obligations prevues par l'une des parties ou par accord commun.",
      "L'accord enregistre par le Bailleur et le Locataire vaut acceptation complete du present contrat. Le sceau appose par la plateforme confirme la validation du contrat dans le systeme.",
      `Fait electroniquement via la plateforme, le ${agreementDate}.`
    ].join("\n");
  }, [agreementDate, contractDuration, editableHouse, landlordName, rentAmount, tenantName]);

  useEffect(() => {
    setEditableHouse(house);
    setContractState(contract || null);
    setHouseLoading(Boolean(requestedHouseId && house?.id !== requestedHouseId));
  }, [contract, house, requestedHouseId]);

  useEffect(() => {
    async function loadRequestedHouse() {
      if (!requestedHouseId || editableHouse?.id === requestedHouseId) {
        setHouseLoading(false);
        return;
      }
      if (authLoading) return;
      if (!user) {
        setHouseLoading(false);
        return;
      }

      const token = await getSupabaseAccessToken();
      if (!token) {
        setHouseLoading(false);
        return;
      }

      setHouseLoading(true);
      try {
        const response = await fetch("/api/dashboard", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store"
        });
        if (!response.ok) return;

        const data = (await response.json()) as AppData;
        setEditableHouse(data.houses.find(item => item.id === requestedHouseId) || null);
        setContractState(data.contracts.find(item => item.houseId === requestedHouseId) || null);
      } finally {
        setHouseLoading(false);
      }
    }

    loadRequestedHouse();
  }, [authLoading, editableHouse?.id, requestedHouseId, user]);

  useEffect(() => {
    const nextTitle = editableHouse?.contractTitle?.trim() || defaultTitle;
    const nextBody = editableHouse?.contractBody?.trim() || defaultBody;
    setEditorTitle(nextTitle);
    setEditorBody(nextBody);
    setEditorDirty(false);
    setEditorKey(value => value + 1);
  }, [defaultBody, editableHouse?.contractBody, editableHouse?.contractTitle, editableHouse?.id]);

  useEffect(() => {
    async function loadContract() {
      if (!supabase || !user || !editableHouse) return;

      const token = await getSupabaseAccessToken();
      if (!token) return;

      const res = await fetch(`/api/contracts?house=${editableHouse.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      if (!res.ok) return;

      const body = (await res.json()) as { contracts?: Contract[] };
      if (body.contracts?.[0]) setContractState(body.contracts[0]);
    }

    loadContract();
  }, [editableHouse, user]);

  function contractPayload(title: string | null, body: string | null) {
    return {
      action: "update_contract_terms",
      contract_duration_months: editableHouse?.contractDurationMonths || 12,
      contract_deposit: editableHouse?.contractDeposit ?? "",
      contract_payment_terms: editableHouse?.contractPaymentTerms || "",
      contract_special_terms: editableHouse?.contractSpecialTerms || "",
      contract_title: title || "",
      contract_body: body || ""
    };
  }

  async function saveContractDraft() {
    if (!editableHouse) return;
    const token = await getSupabaseAccessToken();
    if (!token) {
      toast.error("Connexion requise.");
      return;
    }

    const nextTitle = titleRef.current?.innerText.trim() || defaultTitle;
    const nextBody = bodyRef.current?.innerText.trim() || defaultBody;

    setSavingDraft(true);
    try {
      const res = await fetch(`/api/houses/${editableHouse.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(contractPayload(nextTitle, nextBody))
      });
      const responseBody = await res.json().catch(() => null);
      if (!res.ok) throw new Error(responseBody?.error || "Personnalisation impossible a enregistrer.");

      setEditableHouse(current => current ? { ...current, contractTitle: nextTitle, contractBody: nextBody } : current);
      setEditorTitle(nextTitle);
      setEditorBody(nextBody);
      setEditorDirty(false);
      toast.success("Contrat personnalise enregistre.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Personnalisation impossible a enregistrer.");
    } finally {
      setSavingDraft(false);
    }
  }

  async function resetContractDraft() {
    if (!editableHouse) return;
    const token = await getSupabaseAccessToken();
    if (!token) {
      toast.error("Connexion requise.");
      return;
    }

    setSavingDraft(true);
    try {
      const res = await fetch(`/api/houses/${editableHouse.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(contractPayload(null, null))
      });
      const responseBody = await res.json().catch(() => null);
      if (!res.ok) throw new Error(responseBody?.error || "Modele impossible a restaurer.");

      setEditableHouse(current => current ? { ...current, contractTitle: null, contractBody: null } : current);
      setEditorTitle(defaultTitle);
      setEditorBody(defaultBody);
      setEditorDirty(false);
      setEditorKey(value => value + 1);
      toast.success("Modele de contrat restaure.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Modele impossible a restaurer.");
    } finally {
      setSavingDraft(false);
    }
  }

  async function markAgreement() {
    if (!user) return;

    try {
      if (contractState && isLandlord ? landlordAgreed : tenantAgreed) return;
      if (!contractState && isLandlord) throw new Error("Le bailleur ne peut pas creer un contrat sans locataire.");

      const token = await getSupabaseAccessToken();
      if (!token) throw new Error("Connexion requise.");

      const res = await fetch("/api/contracts", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(contractState ? { contract_id: contractState.id } : { house_id: editableHouse?.id })
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Accord impossible a enregistrer.");

      setContractState(body.contract);
      toast.success("Accord enregistre.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Accord impossible a enregistrer.");
    }
  }

  function printContract() {
    const previousTitle = document.title;
    document.title = `Contrat - ${editableHouse?.title || "BailConnect"}`;
    window.print();
    document.title = previousTitle;
  }

  if (houseLoading || authLoading) {
    return <div className="surface-card text-sm font-semibold text-muted">Chargement du contrat...</div>;
  }

  if (requestedHouseId && !editableHouse) {
    return (
      <div className="surface-card">
        <h2 className="text-2xl font-black">Bien introuvable ou non accessible</h2>
        <p className="mt-2 text-sm text-muted">Le contrat demandé n’est pas disponible pour ce compte.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <div className="grid gap-3 rounded-2xl border border-white/70 bg-white p-4 shadow-card sm:grid-cols-3">
          <div>
            <p className="text-xs font-black uppercase text-muted">Bien</p>
            <p className="mt-1 truncate font-black text-slate-950">{editableHouse?.title || "Bien selectionne"}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-muted">Loyer</p>
            <p className="mt-1 font-black text-slate-950">{rentAmount}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-muted">Statut</p>
            <p className={agreementComplete ? "mt-1 font-black text-emerald-700" : "mt-1 font-black text-amber-700"}>{statusLabel}</p>
          </div>
        </div>

        <div className="contract-print-area contract-paper relative overflow-hidden rounded-2xl border border-white/70 bg-white p-5 shadow-card md:p-8">
          <div className="absolute right-5 top-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-center text-[10px] font-black seal md:h-24 md:w-24 md:text-xs">
            SCEAU<br />BAILCONNECT
          </div>

          <article className="max-w-3xl space-y-5 pr-0 text-sm leading-7 text-slate-700 md:pr-28">
            {canEditContract && (
              <div className="print-hidden inline-flex rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-bold text-brand-900">
                Edition directe active
              </div>
            )}

            <h2
              key={`title-${editorKey}`}
              ref={titleRef}
              contentEditable={canEditContract}
              suppressContentEditableWarning
              onInput={() => setEditorDirty(true)}
              onPaste={pastePlainText}
              className={`max-w-xl whitespace-pre-wrap px-2 py-1 text-2xl font-black uppercase leading-tight text-slate-950 ${editableClass(canEditContract)}`}
            >
              {editorTitle}
            </h2>

            <div
              key={`body-${editorKey}`}
              ref={bodyRef}
              contentEditable={canEditContract}
              suppressContentEditableWarning
              onInput={() => setEditorDirty(true)}
              onPaste={pastePlainText}
              className={`min-h-[320px] whitespace-pre-wrap px-2 py-1 leading-8 text-slate-700 ${editableClass(canEditContract)}`}
            >
              {editorBody}
            </div>

            <div className="grid gap-3 border-t border-slate-100 pt-5 md:grid-cols-2">
              <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-4">
                <p className="text-xs font-black uppercase text-muted">Bailleur</p>
                <p className="mt-1 font-bold text-slate-950">{landlordName}</p>
                <p className={landlordAgreed ? "mt-3 text-xs font-bold text-emerald-700" : "mt-3 text-xs font-bold text-muted"}>
                  {landlordAgreed ? `Accord le ${formatDate(contractState!.agreedByOwnerAt!)}` : "Accord en attente"}
                </p>
              </div>
              <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-4">
                <p className="text-xs font-black uppercase text-muted">Locataire</p>
                <p className="mt-1 font-bold text-slate-950">{tenantName}</p>
                <p className={tenantAgreed ? "mt-3 text-xs font-bold text-emerald-700" : "mt-3 text-xs font-bold text-muted"}>
                  {tenantAgreed ? `Accord le ${formatDate(contractState!.agreedByTenantAt!)}` : "Accord en attente"}
                </p>
              </div>
            </div>

            <div className="grid gap-2 rounded-xl bg-white/70 p-4 text-sm md:grid-cols-2">
              <p><strong>Loyer :</strong> {rentAmount}</p>
              <p><strong>Duree :</strong> {contractDuration}</p>
              {depositAmount && <p><strong>Depot :</strong> {depositAmount}</p>}
              {paymentTerms && <p><strong>Paiement :</strong> {paymentTerms}</p>}
            </div>

            {specialTerms && (
              <details className="rounded-xl bg-brand-50 p-4 text-brand-900">
                <summary className="cursor-pointer text-sm font-black">Clauses particulieres</summary>
                <p className="mt-3 text-sm">{specialTerms}</p>
              </details>
            )}
          </article>
        </div>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-white/70 bg-white p-4 shadow-card">
          <div className="grid grid-cols-2 gap-2 rounded-full bg-slate-100 p-1 text-sm font-black">
            <button
              type="button"
              onClick={() => setSidebarPanel("actions")}
              className={`rounded-full px-3 py-2 transition ${sidebarPanel === "actions" ? "bg-white text-slate-950 shadow-sm" : "text-muted"}`}
            >
              Actions
            </button>
            <button
              type="button"
              onClick={() => setSidebarPanel("messages")}
              className={`rounded-full px-3 py-2 transition ${sidebarPanel === "messages" ? "bg-white text-slate-950 shadow-sm" : "text-muted"}`}
            >
              Messages
            </button>
          </div>

          {sidebarPanel === "actions" ? (
            <div className="mt-5 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black">Actions du contrat</h2>
                  <p className="mt-1 text-sm text-muted">Edition et validation.</p>
                </div>
                <CheckCircle2 className={agreementComplete ? "text-emerald-600" : "text-brand-600"} size={22} />
              </div>

              {canEditContract && (
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-950">
                    <Edit3 size={16} /> Personnalisation
                  </div>
                  <div className="grid gap-2">
                    <button onClick={saveContractDraft} disabled={savingDraft || !editorDirty} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                      <Save size={16} /> {savingDraft ? "Enregistrement..." : editorDirty ? "Enregistrer" : "Contrat a jour"}
                    </button>
                    <button onClick={resetContractDraft} disabled={savingDraft} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">
                      <RotateCcw size={16} /> Restaurer
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-sm">
                {!contractState && (
                  <div className="col-span-2 rounded-xl bg-amber-50 p-3 text-amber-900">
                    <p className="font-black">Aucun contrat actif</p>
                    <p className="mt-1 text-xs">Le locataire peut l'initialiser ici.</p>
                  </div>
                )}
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="font-bold">Bailleur</p>
                  <p className={landlordAgreed ? "text-emerald-700" : "text-muted"}>
                    {landlordAgreed ? "Valide" : "En attente"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="font-bold">Locataire</p>
                  <p className={tenantAgreed ? "text-emerald-700" : "text-muted"}>
                    {tenantAgreed ? "Valide" : "En attente"}
                  </p>
                </div>
              </div>

              <button onClick={markAgreement} disabled={!canMarkAgreement} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-50 px-4 py-3 text-sm font-bold text-brand-700 disabled:opacity-50">
                <CheckCircle2 size={16} /> Valider comme {currentParty}
              </button>
              <button type="button" onClick={printContract} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-bold text-white">
                <Printer size={16} /> Imprimer le contrat
              </button>
            </div>
          ) : (
            <div className="mt-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black">Conversation</h2>
                  <p className="mt-1 text-sm text-muted">Echange lie a ce bien.</p>
                </div>
                <MessageCircle className="text-brand-600" size={22} />
              </div>
              {editableHouse && (
                <InternalMessageThread
                  houseId={editableHouse.id}
                  recipientId={messageRecipientId}
                  emptyText="Aucun message. Le locataire et le proprietaire peuvent echanger ici."
                />
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
