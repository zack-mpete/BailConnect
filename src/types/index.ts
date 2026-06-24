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
  owner: string;
  agency?: string;
  image: string;
  description: string;
  features: string[];
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

export type AppData = {
  users: AppUser[];
  roles: AppRole[];
  houses: House[];
  contracts: Contract[];
  stats: { houses: number; contracts: number; users: number };
};
