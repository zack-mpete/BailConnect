import { NextRequest, NextResponse } from "next/server";
import { apiError, authFailureResponse, getApiClient } from "@/app/api/_supabase";

export async function POST(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const body = await req.json().catch(() => null) as { full_name?: unknown; phone?: unknown } | null;
  if (!body) return apiError("Corps de requete invalide.");
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (fullName.length > 160 || phone.length > 40) return apiError("Profil utilisateur invalide.");

  const { data: authData, error: authError } = await client.auth.getUser().catch(error => ({
    data: { user: null },
    error
  }));
  if (authError || !authData.user) {
    return authFailureResponse("[api/users/sync] Vérification de session impossible.", authError);
  }

  const { data: roleRow, error: roleError } = await client
    .from("role")
    .select("id")
    .eq("name", "locataire")
    .single();

  if (roleError || !roleRow) {
    console.error("[api/users/sync] Rôle locataire introuvable.", {
      code: roleError?.code,
      error: roleError?.message || "Ligne absente"
    });
    return apiError("Role locataire introuvable.", 400);
  }

  const displayName =
    fullName ||
    authData.user.user_metadata?.full_name ||
    authData.user.email?.split("@")[0] ||
    "Utilisateur";

  const { data: existingUser, error: existingUserError } = await client
    .from("users")
    .select("role_id")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (existingUserError) {
    console.error("[api/users/sync] Lecture du rôle existant impossible.", {
      userId: authData.user.id,
      code: existingUserError.code,
      error: existingUserError.message
    });
    return apiError("Profil utilisateur momentanément inaccessible.", 503);
  }

  const profilePayload = {
    full_name: displayName,
    email: authData.user.email,
    phone: phone || null
  };

  const { data: appUser, error: userError } = existingUser
    ? await client
        .from("users")
        .update(profilePayload)
        .eq("id", authData.user.id)
        .select("id,role_id,full_name,email,phone,verified")
        .single()
    : await client
        .from("users")
        .insert({
          id: authData.user.id,
          role_id: roleRow.id,
          ...profilePayload
        })
        .select("id,role_id,full_name,email,phone,verified")
        .single();

  if (userError) {
    console.error("[api/users/sync] Écriture du profil impossible.", {
      userId: authData.user.id,
      code: userError.code,
      error: userError.message
    });
    return apiError(
      userError.code === "42501"
        ? "La policy Supabase bloque la synchronisation du profil utilisateur."
        : userError.message,
      400
    );
  }

  return NextResponse.json({ user: appUser });
}
