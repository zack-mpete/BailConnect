import { NextRequest, NextResponse } from "next/server";
import { notifyUsers } from "@/app/api/_notifications";
import { apiError, getApiClient } from "@/app/api/_supabase";

export async function POST(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const payload = await req.json();
  const { title = "LeaseHub RDC", body = "Nouvelle notification", recipientUserIds = [], type = "manual", metadata = {} } = payload;

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return apiError("Connexion requise.", 401);

  const result = await notifyUsers({
    client,
    actorId: authData.user.id,
    recipientUserIds,
    type,
    title,
    body,
    url: payload.url || "/dashboard",
    metadata
  });

  return NextResponse.json({ ok: true, ...result });
}
