import { NextRequest, NextResponse } from "next/server";
import { getAppData } from "@/lib/data";
import { apiError, getApiClient } from "@/app/api/_supabase";

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

export async function GET() {
  const data = await getAppData();
  return NextResponse.json({ houses: data.houses });
}

export async function POST(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const {
    title,
    description,
    city,
    commune,
    district,
    address,
    latitude,
    longitude,
    price,
    rooms,
    type,
    image_url,
    features
  } = await req.json();

  if (!title || !description || !city || !commune || !price || !rooms || !type) {
    return apiError("Champs maison manquants.");
  }

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return apiError("Connexion requise.", 401);

  const role = await getRoleName(client, authData.user.id);
  if (!["admin", "bailleur", "agence"].includes(role || "")) {
    return apiError("Rôle non autorisé pour publier une maison.", 403);
  }

  const parsedLatitude = latitude === null || latitude === undefined || latitude === "" ? null : Number(latitude);
  const parsedLongitude = longitude === null || longitude === undefined || longitude === "" ? null : Number(longitude);
  if (
    (parsedLatitude !== null && (!Number.isFinite(parsedLatitude) || parsedLatitude < -90 || parsedLatitude > 90)) ||
    (parsedLongitude !== null && (!Number.isFinite(parsedLongitude) || parsedLongitude < -180 || parsedLongitude > 180))
  ) {
    return apiError("Coordonnees invalides.");
  }

  const payload = {
    owner_id: authData.user.id,
    title,
    description,
    city,
    commune,
    district: district || null,
    address: address || null,
    latitude: parsedLatitude,
    longitude: parsedLongitude,
    price: Number(price),
    rooms: Number(rooms),
    type,
    image_url: image_url || null,
    features: Array.isArray(features) ? features : []
  };

  const { data, error: insertError } = await client.from("houses").insert(payload).select("*").single();
  if (insertError) return apiError(insertError.message, 400);

  return NextResponse.json({ house: data }, { status: 201 });
}
