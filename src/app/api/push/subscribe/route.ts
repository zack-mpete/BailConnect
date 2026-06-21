import { NextRequest, NextResponse } from "next/server";
import { apiError, getApiClient } from "@/app/api/_supabase";

export async function POST(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const subscription = await req.json();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return apiError("Connexion requise.", 401);

  if (!subscription?.endpoint) return apiError("Subscription invalide.");

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
