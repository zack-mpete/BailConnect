"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui";
import { houseContractsHref, houseManagerHref, housePublicHref } from "@/lib/house-links";
import { RENTAL_REQUEST_STATUS_LABELS } from "@/lib/statuses";
import { getSupabaseAccessToken } from "@/lib/supabase";
import type { RentalRequest, Role } from "@/types";

export function RentalRequestsPanel({
  role,
  requests,
  onChanged
}: {
  role: Exclude<Role, "admin">;
  requests: RentalRequest[];
  onChanged: () => Promise<void> | void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<RentalRequest | null>(null);
  const [reason, setReason] = useState("");
  const isTenant = role === "locataire";

  async function act(request: RentalRequest, action: "accept" | "reject" | "cancel", decisionReason?: string) {
    const token = await getSupabaseAccessToken();
    if (!token) {
      toast.error("Connexion requise.");
      return;
    }

    setBusyId(request.id);
    try {
      const response = await fetch(`/api/rental-requests/${request.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action, reason: decisionReason })
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Action impossible.");
      toast.success(
        action === "accept" ? "Demande acceptée et contrat créé." :
        action === "reject" ? "Demande refusée." :
        "Demande annulée."
      );
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action impossible.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="surface-card">
        <h2 className="text-xl font-black">{isTenant ? "Mes demandes d’occupation" : "Demandes reçues"}</h2>
        <p className="mt-1 text-sm text-muted">
          {isTenant
            ? "Suis les décisions des bailleurs et ouvre le contrat après acceptation."
            : "Accepte ou refuse les demandes reçues pour tes biens."}
        </p>
      </div>

      <div className="grid gap-3">
        {requests.map(request => (
          <article key={request.id} className="surface-card min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-black">{request.houseTitle}</h3>
                <p className="mt-1 text-sm text-muted">
                  {isTenant ? `Bailleur : ${request.ownerName}` : `Locataire : ${request.tenantName}`}
                </p>
              </div>
              <Badge tone={request.status === "approuvee" ? "success" : request.status === "en_attente" ? "warn" : "default"}>
                {RENTAL_REQUEST_STATUS_LABELS[request.status]}
              </Badge>
            </div>

            {request.message && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">{request.message}</p>}
            {request.decisionReason && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                Motif : {request.decisionReason}
              </p>
            )}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Link
                href={isTenant ? housePublicHref(request.houseId) : houseManagerHref(request.houseId)}
                className="inline-flex justify-center rounded-full bg-slate-100 px-4 py-2 text-sm font-bold"
              >
                Voir le bien
              </Link>
              {request.status === "approuvee" && (
                <Link
                  href={houseContractsHref(request.houseId)}
                  className="inline-flex justify-center rounded-full bg-brand-50 px-4 py-2 text-sm font-bold text-brand-700"
                >
                  Ouvrir le contrat
                </Link>
              )}
              {!isTenant && request.status === "en_attente" && (
                <>
                  <button
                    disabled={busyId === request.id}
                    onClick={() => act(request, "accept")}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} /> Accepter
                  </button>
                  <button
                    disabled={busyId === request.id}
                    onClick={() => {
                      setRejecting(request);
                      setReason("");
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50"
                  >
                    <XCircle size={16} /> Refuser
                  </button>
                </>
              )}
              {isTenant && request.status === "en_attente" && (
                <button
                  disabled={busyId === request.id}
                  onClick={() => act(request, "cancel")}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800 disabled:opacity-50"
                >
                  <Clock3 size={16} /> Annuler la demande
                </button>
              )}
            </div>
          </article>
        ))}
        {!requests.length && (
          <p className="surface-card text-sm font-semibold text-muted">
            {isTenant ? "Aucune demande envoyée." : "Aucune demande reçue pour le moment."}
          </p>
        )}
      </div>

      {rejecting && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="reject-request-title">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-soft">
            <h3 id="reject-request-title" className="text-xl font-black">Refuser la demande</h3>
            <p className="mt-2 text-sm text-muted">{rejecting.tenantName} — {rejecting.houseTitle}</p>
            <label className="mt-4 block text-sm font-bold">
              Motif du refus
              <textarea autoFocus value={reason} onChange={event => setReason(event.target.value)} rows={4} className="mt-2 form-control" />
            </label>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={() => setRejecting(null)} className="rounded-full bg-slate-100 px-4 py-3 text-sm font-bold">Annuler</button>
              <button
                disabled={reason.trim().length < 3 || busyId === rejecting.id}
                onClick={async () => {
                  await act(rejecting, "reject", reason.trim());
                  setRejecting(null);
                }}
                className="rounded-full bg-red-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                Confirmer le refus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
