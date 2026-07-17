"use client";

import { useEffect, useState } from "react";
import { FileSignature, Save } from "lucide-react";
import toast from "react-hot-toast";
import { getSupabaseAccessToken } from "@/lib/supabase";
import type { House } from "@/types";

type OwnerContractEditorProps = {
  house: House;
  onHouseUpdated: (house: House) => void;
};

export function OwnerContractEditor({ house, onHouseUpdated }: OwnerContractEditorProps) {
  const [duration, setDuration] = useState(String(house.contractDurationMonths || 12));
  const [deposit, setDeposit] = useState(house.contractDeposit ? String(house.contractDeposit) : "");
  const [paymentTerms, setPaymentTerms] = useState(house.contractPaymentTerms || "");
  const [specialTerms, setSpecialTerms] = useState(house.contractSpecialTerms || "");
  const [contractTitle, setContractTitle] = useState(house.contractTitle || "");
  const [contractBody, setContractBody] = useState(house.contractBody || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDuration(String(house.contractDurationMonths || 12));
    setDeposit(house.contractDeposit ? String(house.contractDeposit) : "");
    setPaymentTerms(house.contractPaymentTerms || "");
    setSpecialTerms(house.contractSpecialTerms || "");
    setContractTitle(house.contractTitle || "");
    setContractBody(house.contractBody || "");
  }, [
    house.contractBody,
    house.contractDeposit,
    house.contractDurationMonths,
    house.contractPaymentTerms,
    house.contractSpecialTerms,
    house.contractTitle
  ]);

  async function saveContractTerms() {
    const token = await getSupabaseAccessToken();
    if (!token) {
      toast.error("Connexion requise.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/houses/${house.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: "update_contract_terms",
          contract_duration_months: duration,
          contract_deposit: deposit,
          contract_payment_terms: paymentTerms,
          contract_special_terms: specialTerms,
          contract_title: contractTitle,
          contract_body: contractBody
        })
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Modification impossible.");

      onHouseUpdated({
        ...house,
        contractDurationMonths: Number(duration) || house.contractDurationMonths,
        contractDeposit: deposit === "" ? null : Number(deposit),
        contractPaymentTerms: paymentTerms || null,
        contractSpecialTerms: specialTerms || null,
        contractTitle: contractTitle || null,
        contractBody: contractBody || null
      });
      toast.success("Conditions du contrat mises a jour.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Modification impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div id="modifier-contrat" className="surface-card ring-2 ring-brand-50">
      <div className="flex items-center gap-2">
        <FileSignature className="text-brand-600" size={20} />
        <h2 className="text-xl font-black">Modèle des futurs contrats</h2>
      </div>
      <p className="mt-2 text-sm text-muted">
        Ces conditions seront reprises dans le contrat de cette maison : duree, depot, paiement et clauses particulieres.
      </p>

      <label className="mt-4 block text-sm font-bold">
        Titre du contrat
        <input
          value={contractTitle}
          onChange={event => setContractTitle(event.target.value)}
          className="mt-2 form-control"
          placeholder="Contrat de bail a usage d'habitation"
        />
      </label>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-bold">
          Duree du bail en mois
          <input
            value={duration}
            onChange={event => setDuration(event.target.value)}
            type="number"
            min="1"
            max="120"
            className="mt-2 form-control"
          />
        </label>
        <label className="block text-sm font-bold">
          Depot de garantie
          <input
            value={deposit}
            onChange={event => setDeposit(event.target.value)}
            type="number"
            min="0"
            className="mt-2 form-control"
          />
        </label>
      </div>

      <label className="mt-4 block text-sm font-bold">
        Modalites de paiement
        <input value={paymentTerms} onChange={event => setPaymentTerms(event.target.value)} className="mt-2 form-control" />
      </label>

      <label className="mt-4 block text-sm font-bold">
        Clauses particulieres
        <textarea
          value={specialTerms}
          onChange={event => setSpecialTerms(event.target.value)}
          rows={4}
          className="mt-2 form-control"
        />
      </label>

      <label className="mt-4 block text-sm font-bold">
        Texte complet du contrat
        <textarea
          value={contractBody}
          onChange={event => setContractBody(event.target.value)}
          rows={12}
          className="mt-2 form-control font-mono text-sm"
          placeholder="Colle ici le texte complet du contrat. Il remplacera le texte standard affiche au locataire."
        />
      </label>

      <button
        onClick={saveContractTerms}
        disabled={saving}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        <Save size={16} /> {saving ? "Enregistrement..." : "Enregistrer les conditions"}
      </button>
    </div>
  );
}
