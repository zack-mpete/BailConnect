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

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseDuration(value: unknown) {
  if (value === null || value === undefined || value === "") return 12;
  const duration = Number(value);
  return Number.isInteger(duration) && duration >= 1 && duration <= 120 ? duration : null;
}

function parseOptionalAmount(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

export async function GET() {
  const data = await getAppData();
  return NextResponse.json({ houses: data.houses });
}

export async function POST(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return apiError("Corps de requete invalide.");

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
    features,
    contract_duration_months,
    contract_deposit,
    contract_payment_terms,
    contract_special_terms,
    contract_title,
    contract_body
  } = body;

  const parsedTitle = requiredText(title);
  const parsedDescription = requiredText(description);
  const parsedCity = requiredText(city);
  const parsedCommune = requiredText(commune);
  const parsedType = requiredText(type);
  if (!parsedTitle || !parsedDescription || !parsedCity || !parsedCommune || !parsedType) {
    return apiError("Champs maison manquants.");
  }

  const parsedPrice = Number(price);
  const parsedRooms = Number(rooms);
  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) return apiError("Prix invalide.");
  if (!Number.isInteger(parsedRooms) || parsedRooms <= 0 || parsedRooms > 100) return apiError("Nombre de pieces invalide.");

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

  const parsedDuration = parseDuration(contract_duration_months);
  if (parsedDuration === null) return apiError("Duree de contrat invalide.");

  const parsedDeposit = parseOptionalAmount(contract_deposit);
  if (parsedDeposit === undefined) return apiError("Depot de garantie invalide.");

  const payload = {
    owner_id: authData.user.id,
    title: parsedTitle,
    description: parsedDescription,
    city: parsedCity,
    commune: parsedCommune,
    district: optionalText(district),
    address: optionalText(address),
    latitude: parsedLatitude,
    longitude: parsedLongitude,
    price: parsedPrice,
    rooms: parsedRooms,
    type: parsedType,
    image_url: optionalText(image_url),
    features: Array.isArray(features)
      ? features.filter((feature): feature is string => typeof feature === "string" && Boolean(feature.trim())).map(feature => feature.trim()).slice(0, 50)
      : [],
    contract_duration_months: parsedDuration,
    contract_deposit: parsedDeposit,
    contract_payment_terms: optionalText(contract_payment_terms),
    contract_special_terms: optionalText(contract_special_terms),
    contract_title: optionalText(contract_title),
    contract_body: optionalText(contract_body)
  };

  const { data, error: insertError } = await client.from("houses").insert(payload).select("*").single();
  if (insertError) return apiError(insertError.message, 400);

  return NextResponse.json({ house: data }, { status: 201 });
}
