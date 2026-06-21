import { NextRequest, NextResponse } from "next/server";
import { apiError, getApiClient } from "@/app/api/_supabase";

export async function POST(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const { full_name, phone } = await req.json();

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return apiError("Connexion requise.", 401);

  const { data: roleRow, error: roleError } = await client
    .from("role")
    .select("id")
    .eq("name", "locataire")
    .single();

  if (roleError || !roleRow) return apiError("Role locataire introuvable.", 400);

  const displayName =
    full_name ||
    authData.user.user_metadata?.full_name ||
    authData.user.email?.split("@")[0] ||
    "Utilisateur";

  const { data: existingUser } = await client
    .from("users")
    .select("role_id")
    .eq("id", authData.user.id)
    .maybeSingle();

  const userPayload = {
    id: authData.user.id,
    role_id: existingUser?.role_id || roleRow.id,
    full_name: displayName,
    email: authData.user.email,
    phone: phone || null
  };

  const { data: appUser, error: userError } = await client
    .from("users")
    .upsert(userPayload, { onConflict: "id" })
    .select("id,role_id,full_name,email,phone,verified")
    .single();

  if (userError) return apiError(userError.message, 400);

  return NextResponse.json({ user: appUser });
}
