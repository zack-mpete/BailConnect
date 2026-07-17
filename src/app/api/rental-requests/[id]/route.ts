import { NextRequest, NextResponse } from "next/server";
import { notifyUsers } from "@/app/api/_notifications";
import {
  apiError,
  databaseErrorResponse,
  getApiClient,
  getAuthenticatedUser
} from "@/app/api/_supabase";
import { houseContractsHref } from "@/lib/house-links";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const { user, errorResponse } = await getAuthenticatedUser(
    client,
    "[api/rental-requests/id] Vérification de session impossible."
  );
  if (!user) return errorResponse;

  const body = await req.json().catch(() => null) as {
    action?: "accept" | "reject" | "cancel";
    reason?: string;
  } | null;
  if (!body?.action) return apiError("Action manquante.");

  const { data: requestRow } = await client
    .from("rental_requests")
    .select("id,house_id,tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (!requestRow) return apiError("Demande introuvable.", 404);

  const { data: house } = await client
    .from("houses")
    .select("id,owner_id,title")
    .eq("id", requestRow.house_id)
    .maybeSingle();

  if (body.action === "cancel") {
    const { error: cancelError } = await client.rpc("cancel_rental_request", {
      target_request_id: id
    });
    if (cancelError) return databaseErrorResponse(cancelError);

    if (house) {
      await notifyUsers({
        client,
        actorId: user.id,
        recipientUserIds: [house.owner_id],
        type: "rental_request_cancelled",
        title: "Demande annulée",
        body: `La demande concernant ${house.title} a été annulée.`,
        url: "/dashboard?section=requests",
        metadata: { house_id: house.id, rental_request_id: id }
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "reject" && (!body.reason || body.reason.trim().length < 3)) {
    return apiError("Le motif du refus est requis.");
  }

  const { data: contractId, error: decisionError } = await client.rpc("respond_rental_request", {
    target_request_id: id,
    decision: body.action,
    reason: body.reason?.trim() || null
  });
  if (decisionError) return databaseErrorResponse(decisionError);

  await notifyUsers({
    client,
    actorId: user.id,
    recipientUserIds: [requestRow.tenant_id],
    type: body.action === "accept" ? "rental_request_accepted" : "rental_request_rejected",
    title: body.action === "accept" ? "Demande acceptée" : "Demande refusée",
    body: body.action === "accept"
      ? `Ta demande pour ${house?.title || "ce bien"} a été acceptée. Le contrat est prêt.`
      : `Ta demande pour ${house?.title || "ce bien"} a été refusée.`,
    url: body.action === "accept"
      ? houseContractsHref(requestRow.house_id)
      : "/dashboard?section=requests",
    metadata: {
      house_id: requestRow.house_id,
      rental_request_id: id,
      contract_id: contractId || null
    }
  });

  return NextResponse.json({ ok: true, contractId: contractId || null });
}
