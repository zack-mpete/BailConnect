export type Role = "admin" | "bailleur" | "agence" | "locataire";

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
  status: string;
  seal: string;
  agreedByOwnerAt?: string | null;
  agreedByTenantAt?: string | null;
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
  contracts: Contract[];
  payments: Payment[];
  stats: { houses: number; contracts: number; users: number };
};
