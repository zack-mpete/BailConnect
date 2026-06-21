import { NextRequest, NextResponse } from "next/server";
import { notifyUsers } from "@/app/api/_notifications";
import { apiError, getApiClient } from "@/app/api/_supabase";

type HouseRow = {
  id: string;
  title: string;
  owner_id: string;
};

export async function POST(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const { house_id, message } = await req.json();
  if (!house_id) return apiError("Maison manquante.");

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return apiError("Connexion requise.", 401);

  const { data: house, error: houseError } = await client
    .from("houses")
    .select("id,title,owner_id")
    .eq("id", house_id)
    .single();

  if (houseError || !house) return apiError("Maison introuvable.", 404);
  const houseRow = house as HouseRow;
  if (houseRow.owner_id === authData.user.id) return apiError("Le bailleur ne peut pas demander un contrat sur son propre bien.", 403);

  const { data: existing, error: existingError } = await client
    .from("rental_requests")
    .select("*")
    .eq("house_id", house_id)
    .eq("tenant_id", authData.user.id)
    .in("status", ["en_attente", "approuvee"])
    .maybeSingle();

  if (existingError) return apiError(existingError.message, 400);
  if (existing) return NextResponse.json({ request: existing });

  const { data, error: insertError } = await client
    .from("rental_requests")
    .insert({
      house_id,
      tenant_id: authData.user.id,
      message: message || null
    })
    .select("*")
    .single();

  if (insertError) return apiError(insertError.message, 400);

  await notifyUsers({
    client,
    actorId: authData.user.id,
    recipientUserIds: [houseRow.owner_id],
    type: "contract_request_created",
    title: "Nouvelle demande de contrat",
    body: `Un locataire demande un contrat pour ${houseRow.title}.`,
    url: `/contrats?house=${houseRow.id}`,
    metadata: { house_id: houseRow.id, request_id: data.id }
  });

  return NextResponse.json({ request: data }, { status: 201 });
}
