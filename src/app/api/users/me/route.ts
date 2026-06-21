import { NextRequest, NextResponse } from "next/server";
import { apiError, getApiClient } from "@/app/api/_supabase";
import type { Role } from "@/types";

type UserRow = {
  id: string;
  role_id: number | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  verified: boolean;
};

type RoleRow = {
  id: number;
  name: Role;
  label?: string;
  description?: string | null;
};

export async function GET(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  try {
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData.user) return apiError("Connexion requise.", 401);

    const [userResult, rolesResult] = await Promise.all([
      client
        .from("users")
        .select("id,role_id,full_name,email,phone,verified")
        .eq("id", authData.user.id)
        .maybeSingle(),
      client.from("role").select("id,name,label,description")
    ]);

    const appUser = userResult.data as UserRow | null;
    const roles = ((rolesResult.data || []) as RoleRow[]) || [];
    const roleById = new Map(roles.map(role => [role.id, role]));

    if (!appUser) {
      return NextResponse.json({
        user: {
          id: authData.user.id,
          full_name: authData.user.user_metadata?.full_name || authData.user.email?.split("@")[0] || "Utilisateur",
          email: authData.user.email || null,
          phone: null,
          verified: false,
          role: { name: "locataire" satisfies Role }
        }
      });
    }

    const roleId = appUser.role_id || null;
    const roleName = roleId ? roleById.get(roleId)?.name : null;

    return NextResponse.json({
      user: {
        id: authData.user.id,
        full_name: appUser.full_name || authData.user.email?.split("@")[0] || "Utilisateur",
        email: appUser.email || authData.user.email || null,
        phone: appUser.phone || null,
        verified: appUser.verified ?? false,
        role: { name: roleName || "locataire" }
      }
    });
  } catch {
    return apiError("Supabase est momentanément inaccessible.", 503);
  }
}
