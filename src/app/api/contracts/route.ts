import { NextRequest, NextResponse } from "next/server";
import { notifyUsers } from "@/app/api/_notifications";
import { apiError, getApiClient } from "@/app/api/_supabase";
import { houseContractsHref, houseManagerHref } from "@/lib/house-links";
import type { Contract } from "@/types";
import { createClient } from "@supabase/supabase-js";

type ContractRow = {
  id: string;
  house_id: string;
  owner_id: string;
  tenant_id: string;
  start_date: string;
  duration_months: number;
  rent: number | string;
  status: string;
  seal_code: string;
  agreed_by_owner_at?: string | null;
  agreed_by_tenant_at?: string | null;
};

type UserNameRow = {
  id: string;
  full_name: string;
};

type HouseRow = {
  id: string;
  owner_id: string;
  price: number | string;
  contract_duration_months?: number | null;
};

function getWriteClient(fallbackClient: NonNullable<ReturnType<typeof getApiClient>["client"]>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return fallbackClient;
  return createClient(supabaseUrl, serviceRoleKey);
}

function createSealCode() {
  return `BAIL-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

async function getUserNames(client: ReturnType<typeof getApiClient>["client"], ids: string[]) {
  if (!client || ids.length === 0) return new Map<string, string>();
  const { data } = await client.from("users").select("id,full_name").in("id", Array.from(new Set(ids)));
  return new Map(((data || []) as UserNameRow[]).map(user => [user.id, user.full_name]));
}

async function toContract(client: ReturnType<typeof getApiClient>["client"], row: ContractRow): Promise<Contract> {
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
    agreedByTenantAt: row.agreed_by_tenant_at || null
  };
}

export async function GET(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const houseId = req.nextUrl.searchParams.get("house");
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return apiError("Connexion requise.", 401);

  let query = client
    .from("contracts")
    .select("*")
    .or(`owner_id.eq.${authData.user.id},tenant_id.eq.${authData.user.id}`)
    .order("created_at", { ascending: false });

  if (houseId) query = query.eq("house_id", houseId);

  const { data, error: readError } = await query;
  if (readError) return apiError(readError.message, 400);

  const contracts = await Promise.all(((data || []) as ContractRow[]).map(row => toContract(client, row)));

  return NextResponse.json({ contracts });
}

export async function PATCH(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const requestBody = await req.json().catch(() => null) as { contract_id?: string; house_id?: string } | null;
  if (!requestBody) return apiError("Corps de requete invalide.");
  const { contract_id, house_id } = requestBody;
  if (!contract_id && !house_id) return apiError("Contrat ou maison manquant.");

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return apiError("Connexion requise.", 401);

  let contract: unknown = null;
  if (contract_id) {
    const result = await client
      .from("contracts")
      .select("*")
      .eq("id", contract_id)
      .single();

    if (result.error || !result.data) return apiError("Contrat introuvable.", 404);
    contract = result.data;
  } else {
    const { data: house, error: houseError } = await client
      .from("houses")
      .select("id,owner_id,price,contract_duration_months")
      .eq("id", house_id)
      .single();

    if (houseError || !house) return apiError("Maison introuvable.", 404);

    const houseRow = house as HouseRow;
    if (houseRow.owner_id === authData.user.id) {
      return apiError("Le bailleur ne peut pas créer un contrat sans locataire.", 403);
    }

    const { data: existing, error: existingError } = await client
      .from("contracts")
      .select("*")
      .eq("house_id", houseRow.id)
      .eq("tenant_id", authData.user.id)
      .maybeSingle();

    if (existingError) return apiError(existingError.message, 400);
    if (existing) {
      contract = existing;
    } else {
      const writeClient = getWriteClient(client);
      const { data: created, error: createError } = await writeClient
        .from("contracts")
        .insert({
          house_id: houseRow.id,
          owner_id: houseRow.owner_id,
          tenant_id: authData.user.id,
          start_date: new Date().toISOString().slice(0, 10),
          duration_months: houseRow.contract_duration_months || 12,
          rent: Number(houseRow.price),
          seal_code: createSealCode(),
          status: "brouillon"
        })
        .select("*")
        .single();

      if (createError || !created) return apiError(createError?.message || "Création du contrat impossible.", 400);
      contract = created;
    }
  }

  const row = contract as ContractRow;
  const isOwner = authData.user.id === row.owner_id;
  const isTenant = authData.user.id === row.tenant_id;
  if (!isOwner && !isTenant) return apiError("Utilisateur non autorise pour ce contrat.", 403);
  if ((isOwner && row.agreed_by_owner_at) || (isTenant && row.agreed_by_tenant_at)) {
    return NextResponse.json({ contract: await toContract(client, row) });
  }

  const now = new Date().toISOString();
  const patch = isOwner ? { agreed_by_owner_at: now } : { agreed_by_tenant_at: now };

  const ownerAgreed = "agreed_by_owner_at" in patch ? patch.agreed_by_owner_at : row.agreed_by_owner_at;
  const tenantAgreed = "agreed_by_tenant_at" in patch ? patch.agreed_by_tenant_at : row.agreed_by_tenant_at;
  const nextStatus = ownerAgreed && tenantAgreed ? "pret_a_signer" : row.status;

  const { data, error: updateError } = await client
    .from("contracts")
    .update({ ...patch, status: nextStatus })
    .eq("id", row.id)
    .select("*")
    .single();

  if (updateError) return apiError(updateError.message, 400);

  const updated = data as ContractRow;
  if (ownerAgreed && tenantAgreed) {
    const { error: houseUpdateError } = await getWriteClient(client)
      .from("houses")
      .update({
        status: "Loué",
        current_tenant_id: updated.tenant_id,
        current_contract_id: updated.id
      })
      .eq("id", updated.house_id);

    if (houseUpdateError) {
      return apiError(`Contrat accepte, mais occupation non synchronisee: ${houseUpdateError.message}`, 500);
    }
  }

  const recipientId = isTenant ? updated.owner_id : updated.tenant_id;
  await notifyUsers({
    client,
    actorId: authData.user.id,
    recipientUserIds: [recipientId],
    type: ownerAgreed && tenantAgreed ? "contract_fully_agreed" : isTenant ? "contract_tenant_agreed" : "contract_owner_agreed",
    title: ownerAgreed && tenantAgreed ? "Contrat accepte par les deux parties" : isTenant ? "Accord du locataire" : "Accord du bailleur",
    body: ownerAgreed && tenantAgreed
      ? "Les deux parties ont confirme leur accord sur le contrat."
      : isTenant
        ? "Le locataire a confirme son accord sur le contrat."
        : "Le bailleur a confirme son accord sur le contrat.",
    url: isTenant ? houseManagerHref(updated.house_id, "contract") : houseContractsHref(updated.house_id),
    metadata: { house_id: updated.house_id, contract_id: updated.id }
  });

  return NextResponse.json({ contract: await toContract(client, updated) });
}
