import { NextRequest, NextResponse } from "next/server";
import { apiError, getApiClient, getAuthenticatedUser } from "@/app/api/_supabase";
import type { AppRole, AppUser, Contract, House, Payment } from "@/types";

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

type PaymentRow = {
  id: string;
  house_id: string;
  contract_id?: string | null;
  owner_id: string;
  tenant_id?: string | null;
  occupant_name: string;
  amount: number | string;
  period: string;
  paid_at: string;
  method: string;
  reference?: string | null;
  note?: string | null;
  created_at: string;
};

function userName(id: string, users: Map<string, AppUser>) {
  return users.get(id)?.fullName || "Utilisateur";
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

  const { user, errorResponse } = await getAuthenticatedUser(client, "[api/admin/dashboard] Vérification de session impossible.");
  if (!user) return errorResponse;

  if (!(await requireAdmin(client, user.id))) {
    console.warn("[api/admin/dashboard] Accès refusé : rôle administrateur absent.", {
      userId: user.id
    });
    return apiError("Acces administrateur requis.", 403);
  }

  const [rolesResult, usersResult, housesResult, contractsResult, paymentsResult] = await Promise.all([
    client.from("role").select("id,name,label,description").order("label"),
    client.from("users").select("id,role_id,full_name,email,phone,verified").order("created_at", { ascending: false }),
    client.from("houses").select("*").order("created_at", { ascending: false }),
    client.from("contracts").select("*").order("created_at", { ascending: false }),
    client.from("payments").select("*").order("paid_at", { ascending: false })
  ]);

  const firstError = [rolesResult.error, usersResult.error, housesResult.error, contractsResult.error].find(Boolean);
  if (firstError) {
    console.error("[api/admin/dashboard] Chargement des données impossible.", {
      userId: user.id,
      code: firstError.code,
      error: firstError.message
    });
    return apiError(firstError.message, 400);
  }
  if (paymentsResult.error) {
    console.error("[api/admin/dashboard] Chargement des paiements impossible, données partielles renvoyées.", {
      userId: user.id,
      code: paymentsResult.error.code,
      error: paymentsResult.error.message
    });
  }

  const roleRows = (rolesResult.data || []) as AppRole[];
  const userRows = (usersResult.data || []) as UserRow[];
  const houseRows = (housesResult.data || []) as HouseRow[];
  const contractRows = (contractsResult.data || []) as ContractRow[];
  const paymentRows = paymentsResult.error ? [] : (paymentsResult.data || []) as PaymentRow[];

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
    district: row.district,
    address: row.address,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    price: Number(row.price),
    rooms: row.rooms,
    type: row.type,
    status: row.status,
    currentTenantId: row.current_tenant_id || null,
    currentTenant: row.current_tenant_id ? userName(row.current_tenant_id, usersById) : null,
    currentContractId: row.current_contract_id || null,
    owner: userName(row.owner_id, usersById),
    image: row.image_url || "",
    description: row.description,
    features: row.features || [],
    contractDurationMonths: row.contract_duration_months ?? 12,
    contractDeposit: row.contract_deposit === null || row.contract_deposit === undefined ? null : Number(row.contract_deposit),
    contractPaymentTerms: row.contract_payment_terms || null,
    contractSpecialTerms: row.contract_special_terms || null,
    contractTitle: row.contract_title || null,
    contractBody: row.contract_body || null,
    publishedAt: row.created_at
  }));

  const housesById = new Map(houses.map(house => [house.id, house]));

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

  const payments: Payment[] = paymentRows.map(row => ({
    id: row.id,
    houseId: row.house_id,
    contractId: row.contract_id || null,
    ownerId: row.owner_id,
    tenantId: row.tenant_id || null,
    occupantName: row.occupant_name,
    houseTitle: housesById.get(row.house_id)?.title || null,
    amount: Number(row.amount),
    period: row.period,
    paidAt: row.paid_at,
    method: row.method,
    reference: row.reference || null,
    note: row.note || null,
    createdAt: row.created_at
  }));

  return NextResponse.json({
    users,
    roles,
    houses,
    contracts,
    payments,
    stats: {
      houses: houses.length,
      contracts: contracts.length,
      users: users.length
    }
  });
}
