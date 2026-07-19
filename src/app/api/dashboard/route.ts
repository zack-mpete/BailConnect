import { NextRequest, NextResponse } from "next/server";
import { apiError, getApiClient, getAuthenticatedUser } from "@/app/api/_supabase";
import type {
  AppRole,
  AppUser,
  Contract,
  ContractStatus,
  House,
  Payment,
  RentalRequest,
  RentalRequestStatus
} from "@/types";

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
  is_valid: boolean;
  publication_reviewed_at?: string | null;
  publication_reviewed_by?: string | null;
  publication_rejection_reason?: string | null;
  is_archived: boolean;
  archived_at?: string | null;
  archived_by?: string | null;
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
  status: ContractStatus;
  seal_code: string;
  agreed_by_owner_at?: string | null;
  agreed_by_tenant_at?: string | null;
  contract_title?: string | null;
  contract_body?: string | null;
  contract_deposit?: number | string | null;
  contract_payment_terms?: string | null;
  contract_special_terms?: string | null;
  termination_effective_date?: string | null;
  termination_reason?: string | null;
  termination_note?: string | null;
  termination_requested_at?: string | null;
  termination_requested_by?: string | null;
  terminated_at?: string | null;
  terminated_by?: string | null;
};

type RentalRequestRow = {
  id: string;
  house_id: string;
  tenant_id: string;
  message?: string | null;
  status: RentalRequestStatus;
  decision_reason?: string | null;
  decided_at?: string | null;
  decided_by?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
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

function toUser(row: UserRow, rolesById: Map<number, AppRole>): AppUser {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: rolesById.get(row.role_id)?.name || "locataire",
    verified: row.verified
  };
}

function toHouse(row: HouseRow, usersById: Map<string, AppUser>): House {
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
    isValid: row.is_valid,
    publicationReviewedAt: row.publication_reviewed_at || null,
    publicationReviewedBy: row.publication_reviewed_by || null,
    publicationRejectionReason: row.publication_rejection_reason || null,
    isArchived: row.is_archived,
    archivedAt: row.archived_at || null,
    archivedBy: row.archived_by || null,
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
  };
}

function toContract(row: ContractRow, usersById: Map<string, AppUser>): Contract {
  return {
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
    agreedByTenantAt: row.agreed_by_tenant_at || null,
    contractTitle: row.contract_title || null,
    contractBody: row.contract_body || null,
    contractDeposit: row.contract_deposit === null || row.contract_deposit === undefined ? null : Number(row.contract_deposit),
    contractPaymentTerms: row.contract_payment_terms || null,
    contractSpecialTerms: row.contract_special_terms || null,
    terminationEffectiveDate: row.termination_effective_date || null,
    terminationReason: row.termination_reason || null,
    terminationNote: row.termination_note || null,
    terminationRequestedAt: row.termination_requested_at || null,
    terminationRequestedBy: row.termination_requested_by || null,
    terminatedAt: row.terminated_at || null,
    terminatedBy: row.terminated_by || null
  };
}

function toPayment(row: PaymentRow, housesById: Map<string, House>): Payment {
  return {
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
  };
}

export async function GET(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const { user, errorResponse } = await getAuthenticatedUser(client, "[api/dashboard] Vérification de session impossible.");
  if (!user) return errorResponse;

  const [rolesResult, currentUserResult] = await Promise.all([
    client.from("role").select("id,name,label,description").order("label"),
    client.from("users").select("id,role_id,full_name,email,phone,verified").eq("id", user.id).single()
  ]);

  if (rolesResult.error) return apiError(rolesResult.error.message, 400);
  if (currentUserResult.error || !currentUserResult.data) return apiError("Profil utilisateur introuvable.", 404);

  const roles = ((rolesResult.data || []) as AppRole[]).map(role => ({
    id: role.id,
    name: role.name,
    label: role.label,
    description: role.description
  }));
  const rolesById = new Map(roles.map(role => [role.id, role]));
  const currentUser = toUser(currentUserResult.data as UserRow, rolesById);
  const isAdmin = currentUser.role === "admin";

  let contractsQuery = client.from("contracts").select("*").order("created_at", { ascending: false });
  if (!isAdmin) {
    contractsQuery = currentUser.role === "locataire"
      ? contractsQuery.eq("tenant_id", currentUser.id)
      : contractsQuery.eq("owner_id", currentUser.id);
  }

  let paymentsQuery = client.from("payments").select("*").order("paid_at", { ascending: false });
  if (!isAdmin) {
    paymentsQuery = currentUser.role === "locataire"
      ? paymentsQuery.eq("tenant_id", currentUser.id)
      : paymentsQuery.eq("owner_id", currentUser.id);
  }

  const [contractsResult, paymentsResult, requestsResult] = await Promise.all([
    contractsQuery,
    paymentsQuery,
    client.from("rental_requests").select("*").order("created_at", { ascending: false })
  ]);
  if (contractsResult.error) {
    console.error("[api/dashboard] Chargement des contrats impossible.", {
      userId: currentUser.id,
      code: contractsResult.error.code,
      error: contractsResult.error.message
    });
    return apiError(contractsResult.error.message, 400);
  }
  if (paymentsResult.error) {
    console.error("[api/dashboard] Chargement des paiements impossible.", {
      userId: currentUser.id,
      code: paymentsResult.error.code,
      error: paymentsResult.error.message
    });
  }
  if (requestsResult.error) {
    console.error("[api/dashboard] Chargement des demandes impossible.", {
      userId: currentUser.id,
      code: requestsResult.error.code,
      error: requestsResult.error.message
    });
    return apiError(requestsResult.error.message, 400);
  }

  const contractRowsTyped = (contractsResult.data || []) as ContractRow[];
  const contractHouseIds = Array.from(new Set(contractRowsTyped.map(contract => contract.house_id)));

  let housesQuery = client.from("houses").select("*").order("created_at", { ascending: false });
  if (!isAdmin) {
    if (currentUser.role === "locataire") {
      housesQuery = contractHouseIds.length
        ? housesQuery
            .or(`and(status.eq.Disponible,is_valid.eq.true,is_archived.eq.false),id.in.(${contractHouseIds.join(",")})`)
        : housesQuery.eq("status", "Disponible").eq("is_valid", true).eq("is_archived", false);
    } else {
      housesQuery = housesQuery.eq("owner_id", currentUser.id);
    }
  }

  const [usersResult, housesResult] = await Promise.all([
    client.from("users").select("id,role_id,full_name,email,phone,verified").order("created_at", { ascending: false }),
    housesQuery
  ]);

  if (usersResult.error) return apiError(usersResult.error.message, 400);
  if (housesResult.error) return apiError(housesResult.error.message, 400);

  const users = ((usersResult.data || []) as UserRow[]).map(row => toUser(row, rolesById));
  const usersById = new Map(users.map(user => [user.id, user]));
  const houses = ((housesResult.data || []) as HouseRow[]).map(row => toHouse(row, usersById));
  const housesById = new Map(houses.map(house => [house.id, house]));
  const contracts = contractRowsTyped.map(row => toContract(row, usersById));
  const rentalRequests: RentalRequest[] = ((requestsResult.data || []) as RentalRequestRow[]).map(row => {
    const house = housesById.get(row.house_id);
    const ownerId = house?.ownerId || "";
    return {
      id: row.id,
      houseId: row.house_id,
      houseTitle: house?.title || "Bien immobilier",
      ownerId,
      ownerName: ownerId ? userName(ownerId, usersById) : "Bailleur",
      tenantId: row.tenant_id,
      tenantName: userName(row.tenant_id, usersById),
      message: row.message || null,
      status: row.status,
      decisionReason: row.decision_reason || null,
      decidedAt: row.decided_at || null,
      decidedBy: row.decided_by || null,
      cancelledAt: row.cancelled_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  });
  const payments = paymentsResult.error
    ? []
    : ((paymentsResult.data || []) as PaymentRow[]).map(row => toPayment(row, housesById));

  return NextResponse.json({
    users: isAdmin ? users : [currentUser],
    roles,
    houses,
    rentalRequests,
    contracts,
    payments,
    stats: {
      houses: houses.length,
      contracts: contracts.length,
      users: isAdmin ? users.length : 1
    }
  });
}
