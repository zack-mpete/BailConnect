import { NextRequest, NextResponse } from "next/server";
import { apiError, getApiClient } from "@/app/api/_supabase";
import type { Role } from "@/types";

async function getRoleName(client: NonNullable<ReturnType<typeof getApiClient>["client"]>, userId: string) {
  const { data: appUser } = await client
    .from("users")
    .select("role_id")
    .eq("id", userId)
    .maybeSingle();

  if (!appUser?.role_id) return null;
  const { data: role } = await client.from("role").select("name").eq("id", appUser.role_id).maybeSingle();
  return (role?.name || null) as Role | null;
}

async function requireAdmin(client: ReturnType<typeof getApiClient>["client"], userId: string) {
  if (!client) return false;

  return (await getRoleName(client, userId)) === "admin";
}

export async function PATCH(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const { user_id, role } = (await req.json()) as { user_id?: string; role?: Role };
  if (!user_id || !role) return apiError("Utilisateur et rôle requis.");

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return apiError("Connexion requise.", 401);
  if (!(await requireAdmin(client, authData.user.id))) return apiError("Accès administrateur requis.", 403);

  const { data: roleRow, error: roleError } = await client
    .from("role")
    .select("id")
    .eq("name", role)
    .single();

  if (roleError || !roleRow) return apiError("Rôle introuvable.", 400);

  const { data: existingUser } = await client
    .from("users")
    .select("id,full_name,email,phone,verified")
    .eq("id", user_id)
    .maybeSingle();

  if (!existingUser) return apiError("Utilisateur introuvable.", 404);

  const { data, error: updateError } = await client
    .from("users")
    .update({ role_id: roleRow.id })
    .eq("id", user_id)
    .select("id,role_id,full_name,email,phone,verified")
    .single();

  if (updateError) return apiError(updateError.message, 400);

  return NextResponse.json({
    user: {
      id: data.id,
      fullName: data.full_name,
      email: data.email,
      phone: data.phone,
      role,
      verified: data.verified
    }
  });
}
