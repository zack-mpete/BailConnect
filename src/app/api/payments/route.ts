import { NextRequest, NextResponse } from "next/server";
import { apiError, getApiClient } from "@/app/api/_supabase";
import type { Payment, Role } from "@/types";

type UserRoleRow = {
  role_id: number | null;
};

type RoleRow = {
  name: Role;
};

type HouseRow = {
  id: string;
  owner_id: string;
  title: string;
  current_tenant_id?: string | null;
  current_contract_id?: string | null;
};

type ContractRow = {
  id: string;
  house_id: string;
  owner_id: string;
  tenant_id: string;
  status: string;
};

type UserNameRow = {
  id: string;
  full_name: string;
};

type PaymentRow = {
  id: string;
  house_id: string;
  contract_id?: string | null;
  owner_id: string;
  tenant_id?: string | null;
  occupant_name: string;
  amount: number | string;
  period: string;
  paid_at: string;
  method: string;
  reference?: string | null;
  note?: string | null;
  created_at: string;
};

function toPayment(row: PaymentRow, houseTitle?: string | null): Payment {
  return {
    id: row.id,
    houseId: row.house_id,
    contractId: row.contract_id || null,
    ownerId: row.owner_id,
    tenantId: row.tenant_id || null,
    occupantName: row.occupant_name,
    houseTitle: houseTitle || null,
    amount: Number(row.amount),
    period: row.period,
    paidAt: row.paid_at,
    method: row.method,
    reference: row.reference || null,
    note: row.note || null,
    createdAt: row.created_at
  };
}

async function getCurrentRole(client: NonNullable<ReturnType<typeof getApiClient>["client"]>, userId: string) {
  const { data: userData } = await client
    .from("users")
    .select("role_id")
    .eq("id", userId)
    .maybeSingle();

  const roleId = (userData as UserRoleRow | null)?.role_id;
  if (!roleId) return "locataire";

  const { data: roleData } = await client.from("role").select("name").eq("id", roleId).maybeSingle();
  return ((roleData as RoleRow | null)?.name || "locataire") as Role;
}

async function getUserName(client: NonNullable<ReturnType<typeof getApiClient>["client"]>, userId?: string | null) {
  if (!userId) return null;
  const { data } = await client.from("users").select("id,full_name").eq("id", userId).maybeSingle();
  return (data as UserNameRow | null)?.full_name || null;
}

export async function GET(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return apiError("Connexion requise.", 401);

  const role = await getCurrentRole(client, authData.user.id);
  const houseId = req.nextUrl.searchParams.get("house");
  let query = client.from("payments").select("*").order("paid_at", { ascending: false });

  if (houseId) query = query.eq("house_id", houseId);
  if (role !== "admin") {
    query = role === "locataire"
      ? query.eq("tenant_id", authData.user.id)
      : query.eq("owner_id", authData.user.id);
  }

  const { data, error: readError } = await query;
  if (readError) return apiError(readError.message, 400);

  const rows = (data || []) as PaymentRow[];
  const houseIds = Array.from(new Set(rows.map(row => row.house_id)));
  const { data: houses, error: housesError } = houseIds.length
    ? await client.from("houses").select("id,title").in("id", houseIds)
    : { data: [], error: null };

  if (housesError) return apiError(housesError.message, 400);

  const houseTitles = new Map(((houses || []) as Array<{ id: string; title: string }>).map(house => [house.id, house.title]));
  return NextResponse.json({
    payments: rows.map(row => toPayment(row, houseTitles.get(row.house_id)))
  });
}

export async function POST(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const body = await req.json().catch(() => null) as {
    house_id?: string;
    contract_id?: string | null;
    occupant_name?: string;
    amount?: string | number;
    period?: string;
    paid_at?: string;
    method?: string;
    reference?: string;
    note?: string;
  } | null;
  if (!body) return apiError("Corps de requete invalide.");

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return apiError("Connexion requise.", 401);

  const role = await getCurrentRole(client, authData.user.id);
  if (!["bailleur", "agence"].includes(role)) {
    return apiError("Seul le bailleur ou l'agence propriétaire peut enregistrer un paiement.", 403);
  }

  const houseId = body.house_id?.trim();
  if (!houseId) return apiError("Propriete requise.");

  const { data: houseData, error: houseError } = await client
    .from("houses")
    .select("id,owner_id,title,current_tenant_id,current_contract_id")
    .eq("id", houseId)
    .maybeSingle();

  if (houseError || !houseData) return apiError("Propriete introuvable.", 404);
  const house = houseData as HouseRow;

  if (house.owner_id !== authData.user.id) {
    return apiError("Tu ne peux enregistrer un paiement que sur tes propres proprietes.", 403);
  }

  const contractId = body.contract_id || house.current_contract_id || null;
  let contract: ContractRow | null = null;
  if (contractId) {
    const { data: contractData, error: contractError } = await client
      .from("contracts")
      .select("id,house_id,owner_id,tenant_id,status")
      .eq("id", contractId)
      .maybeSingle();

    if (contractError || !contractData) return apiError("Contrat introuvable pour ce paiement.", 404);
    contract = contractData as ContractRow;
    if (contract.house_id !== house.id || contract.owner_id !== house.owner_id) {
      return apiError("Le contrat ne correspond pas a cette propriete.", 400);
    }
    if (!["signe", "resiliation_programmee"].includes(contract.status)) {
      return apiError("Les paiements sont réservés aux contrats actifs.", 409);
    }
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return apiError("Montant de paiement invalide.");

  const period = body.period?.trim();
  if (!period) return apiError("Periode de paiement requise.");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return apiError("Periode de paiement invalide.");

  const paidAt = body.paid_at?.trim() || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAt) || Number.isNaN(Date.parse(`${paidAt}T00:00:00Z`))) {
    return apiError("Date de paiement invalide.");
  }
  const method = body.method?.trim() || "Cash";
  if (method.length > 80) return apiError("Mode de paiement trop long.");
  const tenantId = contract?.tenant_id || house.current_tenant_id || null;
  const occupantName = body.occupant_name?.trim() || await getUserName(client, tenantId) || "Occupant";

  const { data, error: insertError } = await client
    .from("payments")
    .insert({
      house_id: house.id,
      contract_id: contract?.id || null,
      owner_id: house.owner_id,
      tenant_id: tenantId,
      occupant_name: occupantName,
      amount,
      period,
      paid_at: paidAt,
      method,
      reference: body.reference?.trim() || null,
      note: body.note?.trim() || null
    })
    .select("*")
    .single();

  if (insertError || !data) return apiError(insertError?.message || "Paiement impossible a enregistrer.", 400);

  return NextResponse.json({ payment: toPayment(data as PaymentRow, house.title) }, { status: 201 });
}
