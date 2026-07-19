export type Role = "admin" | "bailleur" | "agence" | "locataire";
export type RentalRequestStatus = "en_attente" | "approuvee" | "rejetee" | "annulee";
export type ContractStatus =
  | "brouillon"
  | "pret_a_signer"
  | "signe"
  | "annule"
  | "resiliation_programmee"
  | "resilie";

export type AppRole = {
  id: number;
  name: Role;
  label: string;
  description?: string | null;
};

export type AppUser = {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  role: Role;
  verified: boolean;
};

export type House = {
  id: string;
  ownerId?: string;
  title: string;
  city: string;
  commune: string;
  district?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  price: number;
  rooms: number;
  type: string;
  status: "Disponible" | "Réservé" | "Loué" | "Archivé";
  isValid: boolean;
  publicationReviewedAt?: string | null;
  publicationReviewedBy?: string | null;
  publicationRejectionReason?: string | null;
  isArchived: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
  currentTenantId?: string | null;
  currentTenant?: string | null;
  currentContractId?: string | null;
  owner: string;
  agency?: string;
  image: string;
  description: string;
  features: string[];
  contractDurationMonths?: number | null;
  contractDeposit?: number | null;
  contractPaymentTerms?: string | null;
  contractSpecialTerms?: string | null;
  contractTitle?: string | null;
  contractBody?: string | null;
  publishedAt: string;
};

export type Contract = {
  id: string;
  houseId: string;
  ownerId?: string;
  tenantId?: string;
  tenant: string;
  owner: string;
  startDate: string;
  duration: string;
  rent: number;
  status: ContractStatus;
  seal: string;
  agreedByOwnerAt?: string | null;
  agreedByTenantAt?: string | null;
  contractTitle?: string | null;
  contractBody?: string | null;
  contractDeposit?: number | null;
  contractPaymentTerms?: string | null;
  contractSpecialTerms?: string | null;
  terminationEffectiveDate?: string | null;
  terminationReason?: string | null;
  terminationNote?: string | null;
  terminationRequestedAt?: string | null;
  terminationRequestedBy?: string | null;
  terminatedAt?: string | null;
  terminatedBy?: string | null;
};

export type RentalRequest = {
  id: string;
  houseId: string;
  houseTitle: string;
  ownerId: string;
  ownerName: string;
  tenantId: string;
  tenantName: string;
  message?: string | null;
  status: RentalRequestStatus;
  decisionReason?: string | null;
  decidedAt?: string | null;
  decidedBy?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Payment = {
  id: string;
  houseId: string;
  contractId?: string | null;
  ownerId: string;
  tenantId?: string | null;
  occupantName: string;
  houseTitle?: string | null;
  amount: number;
  period: string;
  paidAt: string;
  method: string;
  reference?: string | null;
  note?: string | null;
  createdAt: string;
};

export type AppData = {
  users: AppUser[];
  roles: AppRole[];
  houses: House[];
  rentalRequests: RentalRequest[];
  contracts: Contract[];
  payments: Payment[];
  stats: { houses: number; contracts: number; users: number };
};
