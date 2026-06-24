"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCircle2, Send } from "lucide-react";
import toast from "react-hot-toast";
import type { Contract, House } from "@/types";
import { useCurrentUser } from "@/lib/auth-client";
import { getSupabaseAccessToken, supabase } from "@/lib/supabase";
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function ContractWorkspace({ house, contract }: ContractWorkspaceProps) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<AgreementMessage[]>([]);
  const [contractState, setContractState] = useState<Contract | null>(contract || null);
  const storageKey = `leasehub-contract-chat-${house?.id || "default"}`;

  const landlordName = contractState?.owner || house?.owner || "[NOM DU BAILLEUR]";
  const tenantName = contractState?.tenant || user?.fullName || "[NOM DU LOCATAIRE]";
  const rentAmount = contractState ? money(contractState.rent) : house ? money(house.price) : "[MONTANT DU LOYER]";
  const contractDuration = contractState?.duration || "12 mois";
  const agreementDate = contractState?.startDate || "[DATE D'ACCORD]";
  const tenantAgreed = Boolean(contractState?.agreedByTenantAt);
  const landlordAgreed = Boolean(contractState?.agreedByOwnerAt);
  const isLandlord = Boolean(user?.id && house?.ownerId && user.id === house.ownerId);
  const currentParty = isLandlord ? "bailleur" : "locataire";
  const canMarkAgreement = Boolean(
    user &&
    (
      contractState
        ? !(isLandlord ? landlordAgreed : tenantAgreed)
        : house && !isLandlord
    )
  );

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

      const token = await getSupabaseAccessToken();
      if (!token) return;

      const res = await fetch(`/api/contracts?house=${house.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      if (!res.ok) return;

      const body = (await res.json()) as { contracts?: Contract[] };
      if (body.contracts?.[0]) setContractState(body.contracts[0]);
    }

    loadContract();
  }, [house, user]);

  async function getToken() {
    return getSupabaseAccessToken();
  }

  async function ensureContract() {
    if (contractState) return contractState;
    if (!user || !house) throw new Error("Contrat indisponible.");
    if (isLandlord) throw new Error("Le bailleur ne peut pas créer un contrat sans locataire.");
    return null;
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

    const recipientUserId = isLandlord ? contractState?.tenantId : contractState?.ownerId || house?.ownerId;
    const token = await getToken();
    if (token && recipientUserId && recipientUserId !== user.id) {
      await fetch("/api/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: "Message contrat",
          body: `${user.fullName}: ${text}`,
          url: `/contrats${house ? `?house=${house.id}` : ""}`,
          type: "contract_message",
          recipientUserIds: [recipientUserId],
          metadata: {
            house_id: house?.id,
            contract_id: contractState?.id
          }
        })
      });
      toast.success("Message envoyé et notification envoyée.");
      return;
    }

    toast.success("Message ajouté à la discussion.");
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
        body: JSON.stringify(currentContract ? { contract_id: currentContract.id } : { house_id: house?.id })
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Accord impossible à enregistrer.");

      setContractState(body.contract);
      toast.success(isLandlord ? "Accord enregistré." : "Accord enregistré et notification envoyée.");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Accord impossible à enregistrer.");
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
          <p>Le présent contrat est conclu pour une durée de <strong>{contractDuration}</strong>, à compter de la date d'accord enregistrée dans la plateforme.</p>
          <p>Le montant du loyer est fixé à <strong>{rentAmount}</strong>.</p>
          <p>Le Locataire s'engage à payer le loyer convenu selon les modalités acceptées entre les deux parties. Il s'engage également à utiliser le logement uniquement à des fins d'habitation, à maintenir le bien en bon état et à signaler au Bailleur tout problème important lié au logement.</p>
          <p>Le Bailleur s'engage à mettre le logement à la disposition du Locataire dans un état conforme à son usage, à respecter les informations publiées sur la plateforme et à garantir au Locataire une occupation paisible du logement pendant toute la durée du bail.</p>
          <p>Le Locataire ne peut pas sous-louer le logement sans autorisation préalable du Bailleur.</p>
          <p>Le présent contrat peut être renouvelé à son expiration par accord entre le Bailleur et le Locataire.</p>
          <p>Le présent contrat peut être résilié en cas de non-respect des obligations prévues par l'une des parties ou par accord commun entre le Bailleur et le Locataire.</p>
          <p>L'accord enregistré par le Bailleur et le Locataire vaut acceptation complète du présent contrat. Le sceau apposé par la plateforme confirme la validation du contrat dans le système.</p>
          <p>Le présent contrat est enregistré dans la plateforme afin d'assurer la transparence, la traçabilité et la conservation des engagements pris entre les deux parties.</p>
          <p>Fait électroniquement via la plateforme, le <strong>{agreementDate}</strong>.</p>

          <div className="grid gap-5 pt-4 md:grid-cols-2">
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5">
              <p><strong>Le Bailleur :</strong> {landlordName}</p>
              <p className="mt-6">Accord : {landlordAgreed ? `validé le ${formatDate(contractState!.agreedByOwnerAt!)}` : "en attente"}</p>
            </div>
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5">
              <p><strong>Le Locataire :</strong> {tenantName}</p>
              <p className="mt-6">Accord : {tenantAgreed ? `validé le ${formatDate(contractState!.agreedByTenantAt!)}` : "en attente"}</p>
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
            <p className="mt-1 text-sm text-muted">Discussion entre bailleur et locataire, puis validation par accord.</p>
          </div>
          <Bell className="text-brand-600" size={22} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
          {!contractState && (
            <div className="col-span-2 rounded-2xl bg-slate-50 p-3 text-slate-700">
              <p className="font-black">Aucun contrat disponible</p>
              <p className="mt-1 text-xs">Un contrat doit exister pour que les parties puissent confirmer leur accord.</p>
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
            <button onClick={sendMessage} disabled={!user || !message.trim()} className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
              <Send size={16} /> Envoyer
            </button>
            <button onClick={markAgreement} disabled={!canMarkAgreement} className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-50 px-4 py-3 text-sm font-bold text-brand-700 disabled:opacity-50">
              <CheckCircle2 size={16} /> Je suis d'accord comme {currentParty}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
