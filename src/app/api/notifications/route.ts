import { NextRequest, NextResponse } from "next/server";
import { apiError, getApiClient } from "@/app/api/_supabase";

export async function GET(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return apiError("Connexion requise.", 401);

  const { data, error: readError } = await client
    .from("notifications")
    .select("id,type,title,body,url,read_at,metadata,created_at")
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (readError) return apiError(readError.message, 400);
  return NextResponse.json({ notifications: data || [] });
}

export async function PATCH(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const { notification_id } = await req.json();
  if (!notification_id) return apiError("Notification manquante.");

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return apiError("Connexion requise.", 401);

  const { data, error: updateError } = await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notification_id)
    .eq("user_id", authData.user.id)
    .select("id")
    .single();

  if (updateError) return apiError(updateError.message, 400);
  return NextResponse.json({ ok: true, notification: data });
}
