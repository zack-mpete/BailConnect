import { NextRequest, NextResponse } from "next/server";
import { apiError, getApiClient } from "@/app/api/_supabase";
import { notifyUsers } from "@/app/api/_notifications";
import { getHouse } from "@/lib/data";

async function getRoleName(client: NonNullable<ReturnType<typeof getApiClient>["client"]>, userId: string) {
  const { data: appUser } = await client
    .from("users")
    .select("role_id")
    .eq("id", userId)
    .maybeSingle();

  if (!appUser?.role_id) return null;
  const { data: role } = await client.from("role").select("name").eq("id", appUser.role_id).maybeSingle();
  return role?.name || null;
}

async function requireAdmin(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return { client, response: error };

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return { client: null, response: apiError("Connexion requise.", 401) };

  const role = await getRoleName(client, authData.user.id);
  if (role !== "admin") {
    return { client: null, response: apiError("Accès administrateur requis.", 403) };
  }

  return { client, response: null };
}

async function requireHouseContractManager(req: NextRequest, houseId: string) {
  const { client, error } = getApiClient(req);
  if (!client) return { client, response: error };

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return { client: null, response: apiError("Connexion requise.", 401) };

  const role = await getRoleName(client, authData.user.id);
  if (!["bailleur", "agence"].includes(role || "")) {
    return { client: null, response: apiError("Role non autorise pour personnaliser le contrat.", 403) };
  }

  const { data: house, error: houseError } = await client
    .from("houses")
    .select("id,owner_id")
    .eq("id", houseId)
    .single();

  if (houseError || !house) return { client: null, response: apiError("Maison introuvable.", 404) };
  if (house.owner_id !== authData.user.id) {
    return { client: null, response: apiError("Tu ne peux personnaliser que tes propres maisons.", 403) };
  }

  return { client, response: null };
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseDuration(value: unknown) {
  if (value === null || value === undefined || value === "") return 12;
  const duration = Number(value);
  return Number.isInteger(duration) && duration >= 1 && duration <= 120 ? duration : null;
}

function parseOptionalAmount(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const house = await getHouse(id);

  if (!house) {
    return NextResponse.json({ error: "Maison introuvable." }, { status: 404 });
  }

  return NextResponse.json({ house });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    action?: "archive" | "restore" | "approve" | "reject" | "validate" | "update_contract_terms";
    reason?: unknown;
    contract_duration_months?: unknown;
    contract_deposit?: unknown;
    contract_payment_terms?: unknown;
    contract_special_terms?: unknown;
    contract_title?: unknown;
    contract_body?: unknown;
  } | null;
  if (!body) return apiError("Corps de requete invalide.");

  if (body.action === "update_contract_terms") {
    const { client, response } = await requireHouseContractManager(req, id);
    if (!client) return response;

    const parsedDuration = parseDuration(body.contract_duration_months);
    if (parsedDuration === null) return apiError("Duree de contrat invalide.");

    const parsedDeposit = parseOptionalAmount(body.contract_deposit);
    if (parsedDeposit === undefined) return apiError("Depot de garantie invalide.");

    const { data, error } = await client
      .from("houses")
      .update({
        contract_duration_months: parsedDuration,
        contract_deposit: parsedDeposit,
        contract_payment_terms: optionalText(body.contract_payment_terms),
        contract_special_terms: optionalText(body.contract_special_terms),
        contract_title: optionalText(body.contract_title),
        contract_body: optionalText(body.contract_body)
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return apiError(error.message, 400);
    return NextResponse.json({ house: data });
  }

  const { client, response } = await requireAdmin(req);
  if (!client) return response;

  const { action } = body;
  const { data: authData } = await client.auth.getUser();
  const { data: currentHouse, error: currentError } = await client
    .from("houses")
    .select("id,owner_id,title,status,current_contract_id,is_archived")
    .eq("id", id)
    .single();
  if (currentError || !currentHouse) return apiError("Maison introuvable.", 404);

  let patch: Record<string, unknown>;
  if (action === "approve" || action === "validate") {
    patch = {
      publication_status: "validee",
      publication_reviewed_at: new Date().toISOString(),
      publication_reviewed_by: authData.user?.id || null,
      publication_rejection_reason: null
    };
  } else if (action === "reject") {
    const reason = optionalText(body.reason);
    if (!reason || reason.length < 3) return apiError("Le motif du rejet est requis.");
    patch = {
      publication_status: "rejetee",
      publication_reviewed_at: new Date().toISOString(),
      publication_reviewed_by: authData.user?.id || null,
      publication_rejection_reason: reason
    };
  } else if (action === "archive") {
    if (currentHouse.is_archived) return apiError("Ce bien est déjà archivé.", 409);
    patch = {
      is_archived: true,
      archived_at: new Date().toISOString(),
      archived_by: authData.user?.id || null
    };
  } else if (action === "restore") {
    if (!currentHouse.is_archived) return apiError("Seul un bien archivé peut être restauré.", 409);
    patch = {
      is_archived: false,
      archived_at: null,
      archived_by: null
    };
  } else {
    return apiError("Action invalide.");
  }

  const { data, error } = await client.from("houses").update(patch).eq("id", id).select("*").single();

  if (error) return apiError(error.message, 400);
  if (action === "approve" || action === "validate" || action === "reject") {
    await notifyUsers({
      client,
      actorId: authData.user!.id,
      recipientUserIds: [currentHouse.owner_id],
      type: action === "reject" ? "house_publication_rejected" : "house_publication_approved",
      title: action === "reject" ? "Publication rejetée" : "Publication validée",
      body: action === "reject"
        ? `${currentHouse.title} doit être corrigée avant publication.`
        : `${currentHouse.title} est maintenant visible publiquement.`,
      url: `/dashboard/houses/${id}`,
      metadata: { house_id: id, reason: action === "reject" ? patch.publication_rejection_reason : null }
    });
  }
  return NextResponse.json({ house: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client, response } = await requireAdmin(req);
  if (!client) return response;

  const { data: house } = await client
    .from("houses")
    .select("id,status,current_contract_id")
    .eq("id", id)
    .maybeSingle();
  if (!house) return apiError("Maison introuvable.", 404);
  if (house.current_contract_id || ["Réservé", "Loué"].includes(house.status)) {
    return apiError("Un bien réservé ou loué ne peut pas être supprimé.", 409);
  }

  const { error } = await client.from("houses").delete().eq("id", id);
  if (error) return apiError(error.message, 400);

  return NextResponse.json({ ok: true });
}
