import { NextRequest, NextResponse } from "next/server";
import { apiError, getApiClient } from "@/app/api/_supabase";

export async function POST(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const subscription = await req.json().catch(() => null) as {
    endpoint?: string;
    keys?: { auth?: string; p256dh?: string };
  } | null;
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return apiError("Connexion requise.", 401);

  if (!subscription?.endpoint || !subscription.keys?.auth || !subscription.keys.p256dh) {
    return apiError("Subscription invalide.");
  }
  if (subscription.endpoint.length > 2048) return apiError("Endpoint de subscription trop long.");

  const { data, error: upsertError } = await client
    .from("push_subscriptions")
    .upsert(
      {
        user_id: authData.user.id,
        endpoint: subscription.endpoint,
        subscription
      },
      { onConflict: "endpoint" }
    )
    .select("*")
    .single();

  if (upsertError) return apiError(upsertError.message, 400);

  return NextResponse.json({ ok: true, subscription: data });
}
