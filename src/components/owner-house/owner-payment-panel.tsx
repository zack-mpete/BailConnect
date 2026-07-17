"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Save, WalletCards } from "lucide-react";
import toast from "react-hot-toast";
import { getSupabaseAccessToken } from "@/lib/supabase";
import { money } from "@/lib/utils";
import type { Contract, House, Payment } from "@/types";

type OwnerPaymentPanelProps = {
  activeContract: Contract | null;
  house: House;
  payments: Payment[];
  onPaymentCreated: (payment: Payment) => void;
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

export function OwnerPaymentPanel({ activeContract, house, payments, onPaymentCreated }: OwnerPaymentPanelProps) {
  const [savingPayment, setSavingPayment] = useState(false);
  const [occupantName, setOccupantName] = useState(activeContract?.tenant || house.currentTenant || "");
  const [amount, setAmount] = useState(String(activeContract?.rent || house.price));
  const [period, setPeriod] = useState(currentMonth);
  const [paidAt, setPaidAt] = useState(currentDate);
  const [method, setMethod] = useState("Cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setOccupantName(activeContract?.tenant || house.currentTenant || "");
    setAmount(String(activeContract?.rent || house.price));
  }, [activeContract?.id, activeContract?.rent, activeContract?.tenant, house.currentTenant, house.price]);

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeContract) {
      toast.error("Aucun contrat actif pour enregistrer un paiement.");
      return;
    }

    const token = await getSupabaseAccessToken();
    if (!token) {
      toast.error("Connexion requise.");
      return;
    }

    setSavingPayment(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          house_id: house.id,
          contract_id: activeContract?.id || house.currentContractId || null,
          occupant_name: occupantName,
          amount,
          period,
          paid_at: paidAt,
          method,
          reference,
          note
        })
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Paiement impossible a enregistrer.");

      onPaymentCreated(body.payment as Payment);
      setReference("");
      setNote("");
      toast.success("Paiement enregistre.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Paiement impossible a enregistrer.");
    } finally {
      setSavingPayment(false);
    }
  }

  return (
    <div id="paiements" className="surface-card ring-2 ring-brand-50">
      <div className="flex items-center gap-2">
        <WalletCards className="text-brand-600" size={20} />
        <h2 className="text-xl font-black">Enregistrer un paiement</h2>
      </div>
      <p className="mt-2 text-sm text-muted">
        Paiement recu pour cette propriete. Le nom de l'occupant est prerempli si un contrat actif existe.
      </p>

      {!activeContract && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          Aucun nouveau paiement ne peut être ajouté sans contrat signé actif.
        </p>
      )}
      <form onSubmit={savePayment} className="mt-4 grid gap-4">
        <label className="block text-sm font-bold">
          Occupant
          <input
            value={occupantName}
            onChange={event => setOccupantName(event.target.value)}
            required
            className="mt-2 form-control"
            placeholder="Nom de l'occupant"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm font-bold">
            Montant
            <input
              value={amount}
              onChange={event => setAmount(event.target.value)}
              type="number"
              min="1"
              step="0.01"
              required
              className="mt-2 form-control"
            />
          </label>
          <label className="block text-sm font-bold">
            Periode
            <input
              value={period}
              onChange={event => setPeriod(event.target.value)}
              type="month"
              required
              className="mt-2 form-control"
            />
          </label>
          <label className="block text-sm font-bold">
            Date recue
            <input
              value={paidAt}
              onChange={event => setPaidAt(event.target.value)}
              type="date"
              required
              className="mt-2 form-control"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-bold">
            Mode de paiement
            <select value={method} onChange={event => setMethod(event.target.value)} className="mt-2 form-control">
              <option>Cash</option>
              <option>Mobile money</option>
              <option>Virement bancaire</option>
              <option>Carte</option>
              <option>Autre</option>
            </select>
          </label>
          <label className="block text-sm font-bold">
            Reference
            <input
              value={reference}
              onChange={event => setReference(event.target.value)}
              className="mt-2 form-control"
              placeholder="Recu, transaction ou note interne"
            />
          </label>
        </div>

        <label className="block text-sm font-bold">
          Note
          <textarea
            value={note}
            onChange={event => setNote(event.target.value)}
            rows={3}
            className="mt-2 form-control"
            placeholder="Details utiles sur le paiement"
          />
        </label>

        <button
          disabled={savingPayment || !activeContract}
          className="inline-flex w-fit items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          <Save size={16} /> {savingPayment ? "Enregistrement..." : "Enregistrer le paiement"}
        </button>
      </form>

      <div className="mt-6">
        <h3 className="text-sm font-black uppercase text-muted">Historique</h3>
        <div className="mt-3 grid gap-2">
          {payments.map(payment => (
            <div key={payment.id} className="grid gap-2 soft-panel text-sm md:grid-cols-[1fr_120px] md:items-center">
              <div>
                <p className="font-black">{payment.occupantName} - {payment.period}</p>
                <p className="text-muted">{payment.method}{payment.reference ? ` - ${payment.reference}` : ""}</p>
              </div>
              <p className="font-black md:text-right">{money(payment.amount)}</p>
            </div>
          ))}

          {!payments.length && (
            <p className="soft-panel text-sm font-semibold text-muted">Aucun paiement enregistre sur cette propriete.</p>
          )}
        </div>
      </div>
    </div>
  );
}
