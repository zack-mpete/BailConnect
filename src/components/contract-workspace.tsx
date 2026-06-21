"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, Send } from "lucide-react";
import toast from "react-hot-toast";
import type { Contract, House } from "@/types";
import { useCurrentUser } from "@/lib/auth-client";
import { supabase } from "@/lib/supabase";
import { money } from "@/lib/utils";

type AgreementMessage = {
  id: string;
  author: string;
  text: string;
  createdAt: string;
};

type ContractWorkspaceProps = {
  house: House | null;
  contract?: Contract | null;
};

type RentalRequest = {
  id: string;
  house_id: string;
  tenant_id: string;
  message: string | null;
  status: string;
  created_at: string;
  tenant?: { full_name?: string; email?: string | null } | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function ContractWorkspace({ house, contract }: ContractWorkspaceProps) {
  const { user } = useCurrentUser();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<AgreementMessage[]>([]);
  const [contractState, setContractState] = useState<Contract | null>(contract || null);
  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const storageKey = `leasehub-contract-chat-${house?.id || "default"}`;

  const landlordName = contractState?.owner || house?.owner || "[NOM DU BAILLEUR]";
  const tenantName = contractState?.tenant || user?.fullName || "[NOM DU LOCATAIRE]";
  const rentAmount = contractState ? money(contractState.rent) : house ? money(house.price) : "[MONTANT DU LOYER]";
  const contractDuration = contractState?.duration || "12 mois";
  const signatureDate = contractState?.startDate || "[DATE DE SIGNATURE]";
  const tenantAgreed = Boolean(contractState?.agreedByTenantAt);
  const landlordAgreed = Boolean(contractState?.agreedByOwnerAt);
  const tenantSigned = Boolean(contractState?.signedByTenantAt);
  const landlordSigned = Boolean(contractState?.signedByOwnerAt);
  const isLandlord = Boolean(user?.id && house?.ownerId && user.id === house.ownerId);
  const currentParty = isLandlord ? "bailleur" : "locataire";
  const recipientUserIds = useMemo(() => {
    const requestTenantIds = requests.map(request => request.tenant_id);
    const ids = [house?.ownerId, contractState?.tenantId, user?.id, ...requestTenantIds].filter((id): id is string => Boolean(id));
    return Array.from(new Set(ids));
  }, [contractState?.tenantId, house?.ownerId, requests, user?.id]);
  const pendingRequest = requests.find(request => request.house_id === house?.id && request.status === "en_attente") || null;

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return;
    try {
      const body = JSON.parse(stored) as { messages?: AgreementMessage[] };
      setMessages(body.messages || []);
    } catch {
      setMessages([]);
    }
  }, [storageKey]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify({ messages }));
  }, [messages, storageKey]);

  useEffect(() => {
    async function loadContract() {
      if (!supabase || !user || !house) return;

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const res = await fetch(`/api/contracts?house=${house.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      if (!res.ok) return;

      const body = (await res.json()) as { contracts?: Contract[]; requests?: RentalRequest[] };
      if (body.contracts?.[0]) setContractState(body.contracts[0]);
      setRequests(body.requests || []);
    }

    loadContract();
  }, [house, user]);

  async function getToken() {
    if (!supabase) return null;
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token || null;
  }

  async function notifyParties(text: string) {
    const token = await getToken();
    if (!token) return;

    await fetch("/api/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title: "Discussion contrat",
        body: text,
        url: `/contrats${house ? `?house=${house.id}` : ""}`,
        recipientUserIds
      })
    });
  }

  async function ensureContract() {
    if (contractState) return contractState;
    if (!user || !house) throw new Error("Contrat impossible à créer.");
    throw new Error("Le bailleur doit d'abord approuver la demande de contrat.");
  }

  async function approveRequest() {
    if (!user || !house || !pendingRequest || !isLandlord) return;

    const token = await getToken();
    if (!token) {
      toast.error("Connexion requise.");
      return;
    }

    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          house_id: house.id,
          request_id: pendingRequest.id,
          start_date: new Date().toISOString().slice(0, 10),
          duration_months: 12,
          rent: house.price
        })
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Création du contrat impossible.");

      setContractState(body.contract);
      setRequests(current => current.map(request => request.id === pendingRequest.id ? { ...request, status: "approuvee" } : request));
      toast.success("Demande approuvée. Le locataire est notifié.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création du contrat impossible.");
    }
  }

  async function sendMessage() {
    const text = message.trim();
    if (!text || !user) return;

    const nextMessage = {
      id: crypto.randomUUID(),
      author: user.fullName,
      text,
      createdAt: new Date().toISOString()
    };
    setMessages(current => [...current, nextMessage]);
    setMessage("");
    await notifyParties(`${user.fullName}: ${text}`);
    toast.success("Message envoyé pour accord.");
  }

  async function markAgreement() {
    if (!user) return;

    try {
      const currentContract = await ensureContract();
      const token = await getToken();
      if (!token) throw new Error("Connexion requise.");

      const res = await fetch("/api/contracts", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ contract_id: currentContract.id })
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Accord impossible à enregistrer.");

      setContractState(body.contract);
      await notifyParties(`${user.fullName} a marqué son accord sur le contrat.`);
      toast.success("Accord enregistré dans la base.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Accord impossible à enregistrer.");
    }
  }

  async function signContract() {
    if (!user) return;

    try {
      const currentContract = await ensureContract();
      const token = await getToken();
      if (!token) throw new Error("Connexion requise.");

      const res = await fetch("/api/contracts", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ contract_id: currentContract.id, action: "sign" })
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Signature impossible à enregistrer.");

      setContractState(body.contract);
      await notifyParties(`${user.fullName} a signé numériquement le contrat.`);
      toast.success("Signature enregistrée dans la base.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Signature impossible à enregistrer.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="contract-paper relative overflow-hidden rounded-xxl border border-white/70 bg-white p-8 shadow-card md:p-12">
        <div className="absolute right-6 top-6 flex h-28 w-28 items-center justify-center rounded-full bg-red-50 text-center text-xs font-black seal md:right-8 md:top-8 md:h-32 md:w-32 md:text-sm">
          SCEAU<br />LEASEHUB<br />RDC
        </div>

        <article className="max-w-3xl space-y-5 pr-0 text-sm leading-7 text-slate-700 md:pr-32 md:text-base">
          <h2 className="max-w-xl text-2xl font-black uppercase leading-tight text-slate-950 md:text-3xl">
            Contrat de bail à usage d'habitation
          </h2>

          <p className="font-semibold text-slate-950">Entre les soussignés :</p>
          <p>Monsieur/Madame <strong>{landlordName}</strong>, ci-après désigné(e) « le Bailleur »,</p>
          <p>Et</p>
          <p>Monsieur/Madame <strong>{tenantName}</strong>, ci-après désigné(e) « le Locataire »,</p>

          <p className="font-semibold text-slate-950">Il a été convenu ce qui suit :</p>
          <p>Le Bailleur met à la disposition du Locataire un bien immobilier à usage d'habitation, conformément aux informations enregistrées dans la plateforme.</p>
          {house && <p>Bien concerné : <strong>{house.title}</strong>, situé à <strong>{house.commune}, {house.city}</strong>.</p>}
          <p>Le présent contrat est conclu pour une durée de <strong>{contractDuration}</strong>, à compter de la date de signature numérique du présent contrat.</p>
          <p>Le montant du loyer est fixé à <strong>{rentAmount}</strong>.</p>
          <p>Le Locataire s'engage à payer le loyer convenu selon les modalités acceptées entre les deux parties. Il s'engage également à utiliser le logement uniquement à des fins d'habitation, à maintenir le bien en bon état et à signaler au Bailleur tout problème important lié au logement.</p>
          <p>Le Bailleur s'engage à mettre le logement à la disposition du Locataire dans un état conforme à son usage, à respecter les informations publiées sur la plateforme et à garantir au Locataire une occupation paisible du logement pendant toute la durée du bail.</p>
          <p>Le Locataire ne peut pas sous-louer le logement sans autorisation préalable du Bailleur.</p>
          <p>Le présent contrat peut être renouvelé à son expiration par accord entre le Bailleur et le Locataire.</p>
          <p>Le présent contrat peut être résilié en cas de non-respect des obligations prévues par l'une des parties ou par accord commun entre le Bailleur et le Locataire.</p>
          <p>La signature numérique du Bailleur et du Locataire vaut acceptation complète du présent contrat. Le sceau numérique apposé par la plateforme confirme la validation du contrat dans le système.</p>
          <p>Le présent contrat est enregistré dans la plateforme afin d'assurer la transparence, la traçabilité et la conservation des engagements pris entre les deux parties.</p>
          <p>Fait électroniquement via la plateforme, le <strong>{signatureDate}</strong>.</p>

          <div className="grid gap-5 pt-4 md:grid-cols-2">
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5">
              <p><strong>Le Bailleur :</strong> {landlordName}</p>
              <p className="mt-6">Signature : ______________________</p>
            </div>
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5">
              <p><strong>Le Locataire :</strong> {tenantName}</p>
              <p className="mt-6">Signature : ______________________</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white/70 p-5">
            <p><strong>Montant du loyer :</strong> {rentAmount}</p>
            <p><strong>Durée du contrat :</strong> {contractDuration}</p>
          </div>
        </article>
      </div>

      <aside className="rounded-xxl border border-white/70 bg-white p-5 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Accord sur le contrat</h2>
            <p className="mt-1 text-sm text-muted">Discussion entre bailleur et locataire avec alerte Web Push.</p>
          </div>
          <Bell className="text-brand-600" size={22} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
          {pendingRequest && isLandlord && !contractState && (
            <div className="col-span-2 rounded-2xl bg-amber-50 p-3 text-amber-900">
              <p className="font-black">Demande en attente</p>
              <p className="mt-1 text-xs">Le locataire {pendingRequest.tenant?.full_name || "intéressé"} souhaite recevoir un contrat pour ce bien.</p>
            </div>
          )}
          {!contractState && !isLandlord && (
            <div className="col-span-2 rounded-2xl bg-slate-50 p-3 text-slate-700">
              <p className="font-black">Contrat en attente</p>
              <p className="mt-1 text-xs">Le bailleur doit approuver ta demande avant que le contrat soit disponible.</p>
            </div>
          )}
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="font-bold">Bailleur</p>
            <p className={landlordAgreed ? "text-emerald-700" : "text-muted"}>
              {landlordAgreed ? `D'accord le ${formatDate(contractState!.agreedByOwnerAt!)}` : "En attente"}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="font-bold">Locataire</p>
            <p className={tenantAgreed ? "text-emerald-700" : "text-muted"}>
              {tenantAgreed ? `D'accord le ${formatDate(contractState!.agreedByTenantAt!)}` : "En attente"}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="font-bold">Signature bailleur</p>
            <p className={landlordSigned ? "text-emerald-700" : "text-muted"}>
              {landlordSigned ? `Signé le ${formatDate(contractState!.signedByOwnerAt!)}` : "Non signé"}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="font-bold">Signature locataire</p>
            <p className={tenantSigned ? "text-emerald-700" : "text-muted"}>
              {tenantSigned ? `Signé le ${formatDate(contractState!.signedByTenantAt!)}` : "Non signé"}
            </p>
          </div>
        </div>

        <div className="mt-5 max-h-72 space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted">Aucun message. Propose une modification ou confirme ton accord.</p>
          ) : (
            messages.map(item => (
              <div key={item.id} className="rounded-2xl bg-white p-3 text-sm shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold">{item.author}</p>
                  <p className="text-[11px] text-muted">{formatDate(item.createdAt)}</p>
                </div>
                <p className="mt-1 text-slate-700">{item.text}</p>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 space-y-3">
          <textarea
            value={message}
            onChange={event => setMessage(event.target.value)}
            rows={4}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500"
            placeholder="Écrire un message sur le loyer, la durée, la date de début..."
          />
          <div className="grid gap-2">
            {pendingRequest && isLandlord && !contractState && (
              <button onClick={approveRequest} disabled={!user} className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 disabled:opacity-50">
                <CheckCircle2 size={16} /> Approuver la demande et créer le contrat
              </button>
            )}
            <button onClick={sendMessage} disabled={!user || !message.trim()} className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
              <Send size={16} /> Envoyer et notifier
            </button>
            <button onClick={markAgreement} disabled={!user || !contractState || (isLandlord ? landlordAgreed : tenantAgreed)} className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-50 px-4 py-3 text-sm font-bold text-brand-700 disabled:opacity-50">
              <CheckCircle2 size={16} /> Je suis d'accord comme {currentParty}
            </button>
            <button onClick={signContract} disabled={!user || !contractState || (isLandlord ? (!landlordAgreed || landlordSigned) : (!landlordAgreed || !tenantAgreed || tenantSigned))} className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 disabled:opacity-50">
              <CheckCircle2 size={16} /> Signer numériquement
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
