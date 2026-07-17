import { NextRequest, NextResponse } from "next/server";
import { notifyUsers } from "@/app/api/_notifications";
import {
  apiError,
  databaseErrorResponse,
  getApiClient,
  getAuthenticatedUser
} from "@/app/api/_supabase";
import type { RentalRequest, RentalRequestStatus } from "@/types";

type RequestRow = {
  id: string;
  house_id: string;
  tenant_id: string;
  message: string | null;
  status: RentalRequestStatus;
  decision_reason: string | null;
  decided_at: string | null;
  decided_by: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

type HouseRow = {
  id: string;
  owner_id: string;
  title: string;
};

type UserRow = {
  id: string;
  full_name: string;
};

async function mapRequests(
  client: NonNullable<ReturnType<typeof getApiClient>["client"]>,
  rows: RequestRow[]
): Promise<RentalRequest[]> {
  const houseIds = Array.from(new Set(rows.map(row => row.house_id)));
  const tenantIds = Array.from(new Set(rows.map(row => row.tenant_id)));
  const [{ data: houses }, { data: users }] = await Promise.all([
    houseIds.length
      ? client.from("houses").select("id,owner_id,title").in("id", houseIds)
      : Promise.resolve({ data: [] as HouseRow[] }),
    tenantIds.length
      ? client.from("users").select("id,full_name").in("id", tenantIds)
      : Promise.resolve({ data: [] as UserRow[] })
  ]);

  const houseById = new Map(((houses || []) as HouseRow[]).map(house => [house.id, house]));
  const ownerIds = Array.from(new Set(Array.from(houseById.values()).map(house => house.owner_id)));
  const { data: owners } = ownerIds.length
    ? await client.from("users").select("id,full_name").in("id", ownerIds)
    : { data: [] as UserRow[] };
  const userById = new Map(
    ([...((users || []) as UserRow[]), ...((owners || []) as UserRow[])]).map(user => [user.id, user.full_name])
  );

  return rows.map(row => {
    const house = houseById.get(row.house_id);
    return {
      id: row.id,
      houseId: row.house_id,
      houseTitle: house?.title || "Bien immobilier",
      ownerId: house?.owner_id || "",
      ownerName: house ? userById.get(house.owner_id) || "Bailleur" : "Bailleur",
      tenantId: row.tenant_id,
      tenantName: userById.get(row.tenant_id) || "Locataire",
      message: row.message,
      status: row.status,
      decisionReason: row.decision_reason,
      decidedAt: row.decided_at,
      decidedBy: row.decided_by,
      cancelledAt: row.cancelled_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  });
}

export async function GET(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const { user, errorResponse } = await getAuthenticatedUser(
    client,
    "[api/rental-requests] Vérification de session impossible."
  );
  if (!user) return errorResponse;

  const { data, error: readError } = await client
    .from("rental_requests")
    .select("id,house_id,tenant_id,message,status,decision_reason,decided_at,decided_by,cancelled_at,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (readError) return databaseErrorResponse(readError);
  return NextResponse.json({ rentalRequests: await mapRequests(client, (data || []) as RequestRow[]) });
}

export async function POST(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const { user, errorResponse } = await getAuthenticatedUser(
    client,
    "[api/rental-requests] Vérification de session impossible."
  );
  if (!user) return errorResponse;

  const body = await req.json().catch(() => null) as { house_id?: string; message?: string } | null;
  if (!body?.house_id) return apiError("Maison manquante.");
  if (body.message && body.message.trim().length > 1000) {
    return apiError("Le message ne peut pas dépasser 1 000 caractères.");
  }

  const { data: requestId, error: createError } = await client.rpc("submit_rental_request", {
    target_house_id: body.house_id,
    request_message: body.message?.trim() || null
  });
  if (createError) return databaseErrorResponse(createError);

  const { data: house } = await client
    .from("houses")
    .select("id,owner_id,title")
    .eq("id", body.house_id)
    .maybeSingle();

  if (house) {
    await notifyUsers({
      client,
      actorId: user.id,
      recipientUserIds: [house.owner_id],
      type: "rental_request_created",
      title: "Nouvelle demande d’occupation",
      body: `Une demande a été envoyée pour ${house.title}.`,
      url: "/dashboard?section=requests",
      metadata: { house_id: house.id, rental_request_id: requestId }
    });
  }

  return NextResponse.json({ id: requestId }, { status: 201 });
}
