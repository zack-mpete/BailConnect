import { NextRequest, NextResponse } from "next/server";
import { apiError, getApiClient, getAuthenticatedUser } from "@/app/api/_supabase";

function isNotificationsSchemaError(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() || "";
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    message.includes("notifications") && (
      message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("could not find")
    )
  );
}

function unavailableResponse(error: { code?: string; message?: string }) {
  console.warn("Notifications are unavailable. Apply supabase-schema.sql to enable them.", {
    code: error.code,
    message: error.message
  });

  return NextResponse.json({
    notifications: [],
    notifications_available: false
  });
}

export async function GET(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const { user, errorResponse } = await getAuthenticatedUser(client, "[api/notifications] Vérification de session impossible.");
  if (!user) return errorResponse;

  const { data, error: readError } = await client
    .from("notifications")
    .select("id,type,title,body,url,read_at,metadata,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (readError && isNotificationsSchemaError(readError)) return unavailableResponse(readError);
  if (readError) return apiError(readError.message, 400);
  return NextResponse.json({ notifications: data || [] });
}

export async function PATCH(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const body = await req.json().catch(() => null) as { notification_id?: string } | null;
  if (!body) return apiError("Corps de requete invalide.");
  const { notification_id } = body;
  if (!notification_id) return apiError("Notification manquante.");

  const { user, errorResponse } = await getAuthenticatedUser(client, "[api/notifications] Vérification de session impossible.");
  if (!user) return errorResponse;

  const { data, error: updateError } = await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notification_id)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (updateError && isNotificationsSchemaError(updateError)) {
    return NextResponse.json({ ok: false, notifications_available: false });
  }
  if (updateError) return apiError(updateError.message, 400);
  return NextResponse.json({ ok: true, notification: data });
}
