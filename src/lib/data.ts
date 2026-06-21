import type { AppData, AppRole, AppUser, Contract, House, Role } from "@/types";
import { createPublicSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { getMockData } from "@/lib/mock";

type RoleRow = {
  id: number;
  name: Role;
  label: string;
  description: string | null;
};

type UserRow = {
  id: string;
  role_id: number | null;
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
  district: string | null;
  address: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  price: number | string;
  rooms: number;
  type: string;
  status: "Disponible" | "Réservé" | "Loué";
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
  signed_by_owner_at?: string | null;
  signed_by_tenant_at?: string | null;
};

const fallbackImage =
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?q=80&w=1200&auto=format&fit=crop";

async function getFallbackData(): Promise<AppData> {
  const mock = await getMockData();
  return {
    ...mock,
    roles: [],
    users: mock.users.map(user => ({
      id: user.id,
      fullName: user.name,
      role: user.role as Role,
      phone: user.phone,
      verified: user.verified
    }))
  };
}

function toRole(row: RoleRow): AppRole {
  return {
    id: row.id,
    name: row.name,
    label: row.label,
    description: row.description
  };
}

function toUser(row: UserRow, rolesById: Map<number, AppRole>): AppUser {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role_id ? rolesById.get(row.role_id)?.name || "locataire" : "locataire",
    verified: row.verified
  };
}

function ownerName(ownerId: string, usersById: Map<string, AppUser>) {
  return usersById.get(ownerId)?.fullName || "Bailleur";
}

function toHouse(row: HouseRow, usersById: Map<string, AppUser>): House {
  const owner = ownerName(row.owner_id, usersById);

  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    city: row.city,
    commune: row.commune,
    district: row.district,
    address: row.address,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    price: Number(row.price),
    rooms: row.rooms,
    type: row.type,
    status: row.status,
    owner,
    agency: "",
    image: row.image_url || fallbackImage,
    description: row.description,
    features: row.features || [],
    publishedAt: row.created_at
  };
}

function toContract(row: ContractRow, usersById: Map<string, AppUser>): Contract {
  return {
    id: row.id,
    houseId: row.house_id,
    ownerId: row.owner_id,
    tenantId: row.tenant_id,
    tenant: ownerName(row.tenant_id, usersById),
    owner: ownerName(row.owner_id, usersById),
    startDate: row.start_date,
    duration: `${row.duration_months} mois`,
    rent: Number(row.rent),
    status: row.status,
    seal: row.seal_code,
    agreedByOwnerAt: row.agreed_by_owner_at || null,
    agreedByTenantAt: row.agreed_by_tenant_at || null,
    signedByOwnerAt: row.signed_by_owner_at || null,
    signedByTenantAt: row.signed_by_tenant_at || null
  };
}

async function countRows(table: string) {
  const client = createPublicSupabaseClient();
  if (!client) return 0;
  const { count } = await client.from(table).select("*", { count: "exact", head: true });
  return count || 0;
}

export async function getAppData(): Promise<AppData> {
  if (!isSupabaseConfigured) {
    return getFallbackData();
  }

  const client = createPublicSupabaseClient();
  if (!client) {
    return getFallbackData();
  }

  const results = await Promise.all([
    client.from("role").select("id,name,label,description").order("label"),
    client.from("users").select("id,role_id,full_name,email,phone,verified").order("created_at", { ascending: false }),
    client.from("houses").select("*").order("created_at", { ascending: false }),
    client.from("contracts").select("*").order("created_at", { ascending: false }),
    countRows("rental_requests")
  ]).catch(() => null);

  if (!results) {
    return getFallbackData();
  }

  const [rolesResult, usersResult, housesResult, contractsResult, requestsCount] = results;

  if (housesResult.error || rolesResult.error) {
    return getFallbackData();
  }

  const roles = ((rolesResult.data || []) as RoleRow[]).map(toRole);
  const rolesById = new Map(roles.map(role => [role.id, role]));
  const users = ((usersResult.data || []) as UserRow[]).map(row => toUser(row, rolesById));
  const usersById = new Map(users.map(user => [user.id, user]));
  const houses = ((housesResult.data || []) as HouseRow[]).map(row => toHouse(row, usersById));
  const contracts = ((contractsResult.data || []) as ContractRow[]).map(row => toContract(row, usersById));

  return {
    users,
    roles,
    houses,
    contracts,
    stats: {
      houses: houses.length,
      contracts: contracts.length,
      users: users.length,
      pendingRequests: requestsCount
    }
  };
}

export async function getHouses() {
  const data = await getAppData();
  return data.houses;
}

export async function getHouse(id: string) {
  const houses = await getHouses();
  return houses.find(house => house.id === id) || null;
}

export async function getRoles() {
  const data = await getAppData();
  return data.roles;
}
