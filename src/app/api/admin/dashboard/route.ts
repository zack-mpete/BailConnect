import { NextRequest, NextResponse } from "next/server";
import { apiError, getApiClient } from "@/app/api/_supabase";
import type { AppRole, AppUser, Contract, House } from "@/types";

type UserRow = {
  id: string;
  role_id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  verified: boolean;
};

type HouseRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  city: string;
  commune: string;
  price: number | string;
  rooms: number;
  type: string;
  status: House["status"];
  image_url: string | null;
  features: string[] | null;
  created_at: string;
};

type ContractRow = {
  id: string;
  house_id: string;
  owner_id: string;
  tenant_id: string;
  start_date: string;
  duration_months: number;
  rent: number | string;
  status: string;
  seal_code: string;
  agreed_by_owner_at?: string | null;
  agreed_by_tenant_at?: string | null;
};

function userName(id: string, users: Map<string, AppUser>) {
  return users.get(id)?.fullName || "Utilisateur";
}

async function safeQuery<T>(query: PromiseLike<{ data: unknown; error: unknown }>) {
  try {
    const result = await query;
    if (result.error) return [] as T[];
    return (result.data || []) as T[];
  } catch {
    return [] as T[];
  }
}

async function requireAdmin(client: ReturnType<typeof getApiClient>["client"], userId: string) {
  if (!client) return false;

  const { data: appUser } = await client
    .from("users")
    .select("role_id")
    .eq("id", userId)
    .maybeSingle();

  if (appUser?.role_id) {
    const { data: role } = await client.from("role").select("name").eq("id", appUser.role_id).maybeSingle();
    if (role?.name === "admin") return true;
  }

  return false;
}

export async function GET(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return apiError("Connexion requise.", 401);
  if (!(await requireAdmin(client, authData.user.id))) return apiError("Accès administrateur requis.", 403);

  const [roleRows, userRows, houseRows, contractRows] = await Promise.all([
    safeQuery<AppRole>(client.from("role").select("id,name,label,description").order("label")),
    safeQuery<UserRow>(client.from("users").select("id,role_id,full_name,email,phone,verified").order("created_at", { ascending: false })),
    safeQuery<HouseRow>(client.from("houses").select("*").order("created_at", { ascending: false })),
    safeQuery<ContractRow>(client.from("contracts").select("*").order("created_at", { ascending: false }))
  ]);

  const roles = roleRows.map(role => ({
    id: role.id,
    name: role.name,
    label: role.label,
    description: role.description
  }));
  const roleById = new Map(roles.map(role => [role.id, role]));

  const usersById = new Map<string, AppUser>();
  userRows.forEach(row => {
    usersById.set(row.id, {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      role: roleById.get(row.role_id)?.name || "locataire",
      verified: row.verified
    });
  });

  const users = Array.from(usersById.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));

  const houses: House[] = houseRows.map(row => ({
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    city: row.city,
    commune: row.commune,
    price: Number(row.price),
    rooms: row.rooms,
    type: row.type,
    status: row.status,
    owner: userName(row.owner_id, usersById),
    image: row.image_url || "",
    description: row.description,
    features: row.features || [],
    publishedAt: row.created_at
  }));

  const contracts: Contract[] = contractRows.map(row => ({
    id: row.id,
    houseId: row.house_id,
    ownerId: row.owner_id,
    tenantId: row.tenant_id,
    tenant: userName(row.tenant_id, usersById),
    owner: userName(row.owner_id, usersById),
    startDate: row.start_date,
    duration: `${row.duration_months} mois`,
    rent: Number(row.rent),
    status: row.status,
    seal: row.seal_code,
    agreedByOwnerAt: row.agreed_by_owner_at || null,
    agreedByTenantAt: row.agreed_by_tenant_at || null
  }));

  return NextResponse.json({
    users,
    roles,
    houses,
    contracts,
    stats: {
      houses: houses.length,
      contracts: contracts.length,
      users: users.length
    }
  });
}
