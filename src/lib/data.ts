import type { AppData, AppRole, House, Role } from "@/types";
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
  full_name: string;
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
  status: House["status"];
  current_tenant_id?: string | null;
  current_contract_id?: string | null;
  image_url: string | null;
  features: string[] | null;
  contract_duration_months?: number | null;
  contract_deposit?: number | string | null;
  contract_payment_terms?: string | null;
  contract_special_terms?: string | null;
  contract_title?: string | null;
  contract_body?: string | null;
  created_at: string;
};

const fallbackImage =
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?q=80&w=1200&auto=format&fit=crop";

const useMockData = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

function emptyData(): AppData {
  return {
    users: [],
    roles: [],
    houses: [],
    contracts: [],
    payments: [],
    stats: { houses: 0, contracts: 0, users: 0 }
  };
}

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
    })),
    payments: mock.payments || []
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

function ownerName(ownerId: string, usersById: Map<string, string>) {
  return usersById.get(ownerId) || "Bailleur";
}

export function toHouse(row: HouseRow, usersById: Map<string, string> = new Map()): House {
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
    currentTenantId: null,
    currentTenant: null,
    currentContractId: null,
    owner,
    agency: "",
    image: row.image_url || fallbackImage,
    description: row.description,
    features: row.features || [],
    contractDurationMonths: row.contract_duration_months ?? 12,
    contractDeposit: row.contract_deposit === null || row.contract_deposit === undefined ? null : Number(row.contract_deposit),
    contractPaymentTerms: row.contract_payment_terms || null,
    contractSpecialTerms: row.contract_special_terms || null,
    contractTitle: row.contract_title || null,
    contractBody: row.contract_body || null,
    publishedAt: row.created_at
  };
}

export async function getAppData(): Promise<AppData> {
  if (useMockData) {
    return getFallbackData();
  }

  if (!isSupabaseConfigured) {
    return emptyData();
  }

  const client = createPublicSupabaseClient();
  if (!client) {
    return emptyData();
  }

  const results = await Promise.all([
    client.from("role").select("id,name,label,description").order("label"),
    client.from("users").select("id,full_name"),
    client
      .from("houses")
      .select("id,owner_id,title,description,city,commune,district,address,latitude,longitude,price,rooms,type,status,image_url,features,contract_duration_months,contract_deposit,contract_payment_terms,contract_special_terms,contract_title,contract_body,created_at")
      .order("created_at", { ascending: false })
  ]).catch(() => null);

  if (!results) {
    return emptyData();
  }

  const [rolesResult, usersResult, housesResult] = results;

  if (housesResult.error || rolesResult.error) {
    return emptyData();
  }

  const roles = ((rolesResult.data || []) as RoleRow[]).map(toRole);
  const usersById = new Map(((usersResult.data || []) as UserRow[]).map(user => [user.id, user.full_name]));
  const houses = ((housesResult.data || []) as HouseRow[]).map(row => toHouse(row, usersById));

  return {
    users: [],
    roles,
    houses,
    contracts: [],
    payments: [],
    stats: {
      houses: houses.length,
      contracts: 0,
      users: 0
    }
  };
}

export async function getHouses() {
  const data = await getAppData();
  return data.houses;
}

export async function getHouse(id: string) {
  const houses = await getHouses();
  const listedHouse = houses.find(house => house.id === id);
  if (listedHouse) return listedHouse;

  // A real Supabase identifier can be opened while the catalog still uses
  // mock data locally. Querying the requested row prevents a valid detail URL
  // from being turned into a Next.js 404 only because it is absent from mock.
  if (!isSupabaseConfigured) return null;

  const client = createPublicSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from("houses")
    .select("id,owner_id,title,description,city,commune,district,address,latitude,longitude,price,rooms,type,status,image_url,features,contract_duration_months,contract_deposit,contract_payment_terms,contract_special_terms,contract_title,contract_body,created_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return toHouse(data as HouseRow);
}

export async function getRoles() {
  if (useMockData || !isSupabaseConfigured) return [];

  const client = createPublicSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from("role")
    .select("id,name,label,description")
    .order("label");

  if (error) return [];
  return ((data || []) as RoleRow[]).map(toRole);
}
