import { NextRequest, NextResponse } from "next/server";
import { notifyUsers } from "@/app/api/_notifications";
import {
  apiError,
  databaseErrorResponse,
  getApiClient,
  getAuthenticatedUser
} from "@/app/api/_supabase";
import { houseContractsHref } from "@/lib/house-links";
import type { Contract, ContractStatus } from "@/types";

type ContractRow = {
  id: string;
  house_id: string;
  owner_id: string;
  tenant_id: string;
  start_date: string;
  duration_months: number;
  rent: number | string;
  status: ContractStatus;
  seal_code: string;
  agreed_by_owner_at?: string | null;
  agreed_by_tenant_at?: string | null;
  contract_title?: string | null;
  contract_body?: string | null;
  contract_deposit?: number | string | null;
  contract_payment_terms?: string | null;
  contract_special_terms?: string | null;
  termination_effective_date?: string | null;
  termination_reason?: string | null;
  termination_note?: string | null;
  termination_requested_at?: string | null;
  termination_requested_by?: string | null;
  terminated_at?: string | null;
  terminated_by?: string | null;
};

type UserNameRow = {
  id: string;
  full_name: string;
};

async function getUserNames(
  client: NonNullable<ReturnType<typeof getApiClient>["client"]>,
  ids: string[]
) {
  if (!ids.length) return new Map<string, string>();
  const { data } = await client.from("users").select("id,full_name").in("id", Array.from(new Set(ids)));
  return new Map(((data || []) as UserNameRow[]).map(user => [user.id, user.full_name]));
}

async function toContract(
  client: NonNullable<ReturnType<typeof getApiClient>["client"]>,
  row: ContractRow
): Promise<Contract> {
  const names = await getUserNames(client, [row.owner_id, row.tenant_id]);

  return {
    id: row.id,
    houseId: row.house_id,
    ownerId: row.owner_id,
    tenantId: row.tenant_id,
    owner: names.get(row.owner_id) || "Bailleur",
    tenant: names.get(row.tenant_id) || "Locataire",
    startDate: row.start_date,
    duration: `${row.duration_months} mois`,
    rent: Number(row.rent),
    status: row.status,
    seal: row.seal_code,
    agreedByOwnerAt: row.agreed_by_owner_at || null,
    agreedByTenantAt: row.agreed_by_tenant_at || null,
    contractTitle: row.contract_title || null,
    contractBody: row.contract_body || null,
    contractDeposit: row.contract_deposit === null || row.contract_deposit === undefined
      ? null
      : Number(row.contract_deposit),
    contractPaymentTerms: row.contract_payment_terms || null,
    contractSpecialTerms: row.contract_special_terms || null,
    terminationEffectiveDate: row.termination_effective_date || null,
    terminationReason: row.termination_reason || null,
    terminationNote: row.termination_note || null,
    terminationRequestedAt: row.termination_requested_at || null,
    terminationRequestedBy: row.termination_requested_by || null,
    terminatedAt: row.terminated_at || null,
    terminatedBy: row.terminated_by || null
  };
}

async function getContract(
  client: NonNullable<ReturnType<typeof getApiClient>["client"]>,
  contractId: string
) {
  return client.from("contracts").select("*").eq("id", contractId).maybeSingle();
}

export async function GET(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const { user, errorResponse } = await getAuthenticatedUser(
    client,
    "[api/contracts] Vérification de session impossible."
  );
  if (!user) return errorResponse;

  const houseId = req.nextUrl.searchParams.get("house");
  let query = client
    .from("contracts")
    .select("*")
    .order("created_at", { ascending: false });
  if (houseId) query = query.eq("house_id", houseId);

  const { data, error: readError } = await query;
  if (readError) return databaseErrorResponse(readError);

  const contracts = await Promise.all(
    ((data || []) as ContractRow[]).map(row => toContract(client, row))
  );
  return NextResponse.json({ contracts });
}

export async function PATCH(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const { user, errorResponse } = await getAuthenticatedUser(
    client,
    "[api/contracts] Vérification de session impossible."
  );
  if (!user) return errorResponse;

  const body = await req.json().catch(() => null) as {
    contract_id?: string;
    action?: "agree" | "request_termination" | "finalize_termination";
    effective_date?: string;
    reason?: string;
    note?: string;
  } | null;
  if (!body?.contract_id || !body.action) return apiError("Contrat ou action manquant.");

  const beforeResult = await getContract(client, body.contract_id);
  if (beforeResult.error || !beforeResult.data) return apiError("Contrat introuvable.", 404);
  const before = beforeResult.data as ContractRow;

  let rpcError: { code?: string; message?: string } | null = null;
  if (body.action === "agree") {
    const result = await client.rpc("record_contract_agreement", {
      target_contract_id: body.contract_id
    });
    rpcError = result.error;
  } else if (body.action === "request_termination") {
    if (!body.effective_date) return apiError("La date de résiliation est requise.");
    if (!body.reason || body.reason.trim().length < 3) return apiError("Le motif de résiliation est requis.");
    const result = await client.rpc("request_contract_termination", {
      target_contract_id: body.contract_id,
      effective_date: body.effective_date,
      reason: body.reason.trim(),
      note: body.note?.trim() || null
    });
    rpcError = result.error;
  } else {
    const result = await client.rpc("finalize_contract_termination", {
      target_contract_id: body.contract_id
    });
    rpcError = result.error;
  }
  if (rpcError) return databaseErrorResponse(rpcError);

  const afterResult = await getContract(client, body.contract_id);
  if (afterResult.error || !afterResult.data) return databaseErrorResponse(afterResult.error);
  const updated = afterResult.data as ContractRow;

  const recipientIds = [updated.owner_id, updated.tenant_id].filter(id => id !== user.id);
  const event = body.action === "agree"
    ? updated.status === "signe"
      ? {
          type: "contract_signed",
          title: "Contrat signé",
          body: "Les deux parties ont confirmé le contrat."
        }
      : {
          type: "contract_agreement",
          title: "Nouvel accord sur le contrat",
          body: "Une partie a confirmé son accord."
        }
    : body.action === "request_termination"
      ? {
          type: "contract_termination_requested",
          title: updated.status === "resilie" ? "Contrat résilié" : "Résiliation programmée",
          body: updated.status === "resilie"
            ? "Le contrat a été résilié."
            : `La résiliation est programmée au ${updated.termination_effective_date}.`
        }
      : {
          type: "contract_termination_finalized",
          title: "Résiliation finalisée",
          body: "La résiliation programmée a été finalisée par un administrateur."
        };

  await notifyUsers({
    client,
    actorId: user.id,
    recipientUserIds: recipientIds,
    ...event,
    url: houseContractsHref(updated.house_id),
    metadata: {
      house_id: updated.house_id,
      contract_id: updated.id,
      previous_status: before.status,
      status: updated.status
    }
  });

  return NextResponse.json({ contract: await toContract(client, updated) });
}
