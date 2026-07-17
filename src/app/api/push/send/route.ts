import { NextRequest, NextResponse } from "next/server";
import { notifyUsers } from "@/app/api/_notifications";
import { apiError, getApiClient } from "@/app/api/_supabase";
import { isKnownAppRoute, routes } from "@/lib/routes";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function isAdmin(client: NonNullable<ReturnType<typeof getApiClient>["client"]>, userId: string) {
  const { data: user } = await client.from("users").select("role_id").eq("id", userId).maybeSingle();
  if (!user?.role_id) return false;
  const { data: role } = await client.from("role").select("name").eq("id", user.role_id).maybeSingle();
  return role?.name === "admin";
}

export async function POST(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const payload = await req.json().catch(() => null) as {
    title?: unknown;
    body?: unknown;
    recipientUserIds?: unknown;
    type?: unknown;
    metadata?: unknown;
    url?: unknown;
  } | null;
  if (!payload) return apiError("Corps de requete invalide.");

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return apiError("Connexion requise.", 401);
  if (!(await isAdmin(client, authData.user.id))) return apiError("Acces administrateur requis.", 403);

  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "BailConnect";
  const body = typeof payload.body === "string" && payload.body.trim() ? payload.body.trim() : "Nouvelle notification";
  const type = typeof payload.type === "string" && payload.type.trim() ? payload.type.trim() : "manual";
  const url = typeof payload.url === "string" && isKnownAppRoute(payload.url) ? payload.url : routes.dashboard;
  const metadata: Record<string, unknown> = payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
    ? payload.metadata as Record<string, unknown>
    : {};
  const recipientUserIds = Array.isArray(payload.recipientUserIds)
    ? Array.from(new Set(payload.recipientUserIds.filter((id): id is string => typeof id === "string" && uuidPattern.test(id))))
    : [];

  if (!recipientUserIds.length) return apiError("Au moins un destinataire valide est requis.");
  if (title.length > 160 || body.length > 2000 || type.length > 80) return apiError("Notification trop longue.");

  const result = await notifyUsers({
    client,
    actorId: authData.user.id,
    recipientUserIds,
    type,
    title,
    body,
    url,
    metadata
  });

  return NextResponse.json({ ok: true, ...result });
}
