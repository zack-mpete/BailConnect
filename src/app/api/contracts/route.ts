import { NextRequest, NextResponse } from "next/server";
import { notifyUsers } from "@/app/api/_notifications";
import { apiError, getApiClient } from "@/app/api/_supabase";
import type { Contract } from "@/types";

type ContractAction = "agree" | "sign";

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
  contract_request_id?: string | null;
  agreed_by_owner_at?: string | null;
  agreed_by_tenant_at?: string | null;
  signed_by_owner_at?: string | null;
  signed_by_tenant_at?: string | null;
};

type UserNameRow = {
  id: string;
  full_name: string;
};

type HouseRow = {
  id: string;
  title?: string;
  owner_id: string;
  price?: number | string;
};

type RentalRequestPayload = {
  id: string;
  house_id: string;
  tenant_id: string;
  message: string | null;
  status: string;
  created_at: string;
  house?: HouseRow | null;
  tenant?: { id?: string; full_name?: string; email?: string | null } | null;
};

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
    agreedByTenantAt: row.agreed_by_tenant_at || null,
    signedByOwnerAt: row.signed_by_owner_at || null,
    signedByTenantAt: row.signed_by_tenant_at || null
  };
}

async function getAdminIds(client: ReturnType<typeof getApiClient>["client"]) {
  if (!client) return [];
  const { data: role } = await client.from("role").select("id").eq("name", "admin").maybeSingle();
  if (!role?.id) return [];
  const { data: admins } = await client.from("users").select("id").eq("role_id", role.id);
  return ((admins || []) as Array<{ id: string }>).map(admin => admin.id);
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

  const { data: ownedHouses } = await client.from("houses").select("id,title,owner_id,price").eq("owner_id", authData.user.id);
  const ownedHouseIds = ((ownedHouses || []) as HouseRow[]).map(house => house.id);

  const requestQueries = [
    client
      .from("rental_requests")
      .select("id,house_id,tenant_id,message,status,created_at,house:house_id(id,title,owner_id,price),tenant:tenant_id(id,full_name,email)")
      .eq("tenant_id", authData.user.id)
      .order("created_at", { ascending: false })
  ];

  if (ownedHouseIds.length) {
    requestQueries.push(
      client
        .from("rental_requests")
        .select("id,house_id,tenant_id,message,status,created_at,house:house_id(id,title,owner_id,price),tenant:tenant_id(id,full_name,email)")
        .in("house_id", ownedHouseIds)
        .order("created_at", { ascending: false })
    );
  }

  const requestResults = await Promise.all(requestQueries);
  const requests = requestResults.flatMap(result => ((result.data || []) as unknown) as RentalRequestPayload[]);
  const uniqueRequests = Array.from(new Map(requests.map(request => [request.id, request])).values());

  return NextResponse.json({ contracts, requests: uniqueRequests });
}

export async function POST(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const { house_id, request_id, start_date, duration_months = 12, rent } = await req.json();
  if (!house_id || !request_id || !start_date || !rent) return apiError("Champs contrat manquants.");

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return apiError("Connexion requise.", 401);

  const { data: house, error: houseError } = await client
    .from("houses")
    .select("id,title,owner_id,price")
    .eq("id", house_id)
    .single();

  if (houseError || !house) return apiError("Maison introuvable.", 404);
  const houseRow = house as HouseRow;
  if (houseRow.owner_id !== authData.user.id) return apiError("Seul le bailleur peut approuver la demande de contrat.", 403);

  const { data: requestRow, error: requestError } = await client
    .from("rental_requests")
    .select("*")
    .eq("id", request_id)
    .eq("house_id", house_id)
    .single();

  if (requestError || !requestRow) return apiError("Demande de contrat introuvable.", 404);
  if (requestRow.tenant_id === authData.user.id) return apiError("Le bailleur ne peut pas etre le locataire du meme contrat.", 403);
  if (requestRow.status === "rejetee") return apiError("Cette demande a ete rejetee.", 400);

  const { data: existing, error: existingError } = await client
    .from("contracts")
    .select("*")
    .eq("house_id", house_id)
    .eq("tenant_id", requestRow.tenant_id)
    .maybeSingle();

  if (existingError) return apiError(existingError.message, 400);
  if (existing) return NextResponse.json({ contract: await toContract(client, existing as ContractRow) });

  const now = new Date().toISOString();
  const sealCode = `BAIL-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const { data, error: insertError } = await client
    .from("contracts")
    .insert({
      house_id,
      owner_id: houseRow.owner_id,
      tenant_id: requestRow.tenant_id,
      start_date,
      duration_months: Number(duration_months),
      rent: Number(rent),
      seal_code: sealCode,
      contract_request_id: request_id,
      agreed_by_owner_at: now,
      status: "brouillon"
    })
    .select("*")
    .single();

  if (insertError) return apiError(insertError.message, 400);

  await client
    .from("rental_requests")
    .update({ status: "approuvee", updated_at: now })
    .eq("id", request_id);

  await notifyUsers({
    client,
    actorId: authData.user.id,
    recipientUserIds: [requestRow.tenant_id],
    type: "contract_request_approved",
    title: "Demande de contrat approuvee",
    body: `Le bailleur a approuve ta demande pour ${houseRow.title || "le logement"}.`,
    url: `/contrats?house=${house_id}`,
    metadata: { house_id, request_id, contract_id: data.id }
  });

  return NextResponse.json({ contract: await toContract(client, data as ContractRow) }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const { contract_id, action = "agree" } = (await req.json()) as { contract_id?: string; action?: ContractAction };
  if (!contract_id) return apiError("Contrat manquant.");
  if (!["agree", "sign"].includes(action)) return apiError("Action contrat invalide.");

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return apiError("Connexion requise.", 401);

  const { data: contract, error: readError } = await client
    .from("contracts")
    .select("*")
    .eq("id", contract_id)
    .single();

  if (readError || !contract) return apiError("Contrat introuvable.", 404);

  const row = contract as ContractRow;
  const isOwner = authData.user.id === row.owner_id;
  const isTenant = authData.user.id === row.tenant_id;
  if (!isOwner && !isTenant) return apiError("Utilisateur non autorise pour ce contrat.", 403);

  if (action === "sign" && isTenant && (!row.agreed_by_owner_at || !row.agreed_by_tenant_at)) {
    return apiError("Les deux parties doivent d'abord marquer leur accord avant la signature.", 400);
  }

  if (action === "sign" && isOwner && !row.agreed_by_owner_at) {
    return apiError("Le bailleur doit d'abord approuver la demande.", 400);
  }

  const now = new Date().toISOString();
  const patch =
    action === "sign"
      ? isOwner
        ? { signed_by_owner_at: now }
        : { signed_by_tenant_at: now }
      : isOwner
        ? { agreed_by_owner_at: now }
        : row.signed_by_owner_at
          ? { agreed_by_tenant_at: now, signed_by_tenant_at: now }
          : { agreed_by_tenant_at: now };

  const ownerAgreed = "agreed_by_owner_at" in patch ? patch.agreed_by_owner_at : row.agreed_by_owner_at;
  const tenantAgreed = "agreed_by_tenant_at" in patch ? patch.agreed_by_tenant_at : row.agreed_by_tenant_at;
  const ownerSigned = "signed_by_owner_at" in patch ? patch.signed_by_owner_at : row.signed_by_owner_at;
  const tenantSigned = "signed_by_tenant_at" in patch ? patch.signed_by_tenant_at : row.signed_by_tenant_at;
  const nextStatus = ownerSigned && (tenantSigned || tenantAgreed) ? "signe" : ownerAgreed && tenantAgreed ? "pret_a_signer" : row.status;

  const { data, error: updateError } = await client
    .from("contracts")
    .update({ ...patch, status: nextStatus })
    .eq("id", contract_id)
    .select("*")
    .single();

  if (updateError) return apiError(updateError.message, 400);

  const updated = data as ContractRow;
  if (action === "sign" && isOwner) {
    await notifyUsers({
      client,
      actorId: authData.user.id,
      recipientUserIds: [updated.tenant_id],
      type: "contract_owner_signed",
      title: "Contrat signe par le bailleur",
      body: "Le bailleur a signe le contrat. Tu peux maintenant le consulter et confirmer ton accord.",
      url: `/contrats?house=${updated.house_id}`,
      metadata: { house_id: updated.house_id, contract_id: updated.id }
    });
  }

  if (action === "agree" && isTenant) {
    const adminIds = await getAdminIds(client);
    await notifyUsers({
      client,
      actorId: authData.user.id,
      recipientUserIds: [updated.owner_id, ...adminIds],
      type: "contract_tenant_agreed",
      title: "Contrat accepte par le locataire",
      body: "Le locataire a confirme son accord. Le contrat est pret pour suivi administratif.",
      url: `/contrats?house=${updated.house_id}`,
      metadata: { house_id: updated.house_id, contract_id: updated.id }
    });
  }

  return NextResponse.json({ contract: await toContract(client, updated) });
}
