import { NextRequest, NextResponse } from "next/server";
import { apiError, getApiClient } from "@/app/api/_supabase";
import { getHouse } from "@/lib/data";

async function getRoleName(client: NonNullable<ReturnType<typeof getApiClient>["client"]>, userId: string) {
  const { data: appUser } = await client
    .from("users")
    .select("role_id")
    .eq("id", userId)
    .maybeSingle();

  if (!appUser?.role_id) return null;
  const { data: role } = await client.from("role").select("name").eq("id", appUser.role_id).maybeSingle();
  return role?.name || null;
}

async function requireAdmin(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return { client, response: error };

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return { client: null, response: apiError("Connexion requise.", 401) };

  const role = await getRoleName(client, authData.user.id);
  if (role !== "admin") {
    return { client: null, response: apiError("Accès administrateur requis.", 403) };
  }

  return { client, response: null };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const house = await getHouse(id);

  if (!house) {
    return NextResponse.json({ error: "Maison introuvable." }, { status: 404 });
  }

  return NextResponse.json({ house });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client, response } = await requireAdmin(req);
  if (!client) return response;

  const { action } = (await req.json()) as { action?: "archive" | "restore" };
  const nextStatus = action === "archive" ? "Archivé" : action === "restore" ? "Disponible" : null;
  if (!nextStatus) return apiError("Action invalide.");

  const { data, error } = await client
    .from("houses")
    .update({ status: nextStatus })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return apiError(error.message, 400);
  return NextResponse.json({ house: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client, response } = await requireAdmin(req);
  if (!client) return response;

  const { error } = await client.from("houses").delete().eq("id", id);
  if (error) return apiError(error.message, 400);

  return NextResponse.json({ ok: true });
}
