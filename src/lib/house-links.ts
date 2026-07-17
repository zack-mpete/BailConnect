import type { House, Role } from "@/types";

type HouseLinkUser = {
  id: string;
  role: Role;
} | null | undefined;

type ManagerHouseSection = "payments" | "contract" | "messages";

const managerSectionHash: Record<ManagerHouseSection, string> = {
  payments: "#paiements",
  contract: "#modifier-contrat",
  messages: "#contacter-locataire"
};

export function canManageHouse(user: HouseLinkUser, house: Pick<House, "ownerId">) {
  return Boolean(
    user
    && ["bailleur", "agence"].includes(user.role)
    && user.id === house.ownerId
  );
}

export function canInspectHouse(user: HouseLinkUser, house: Pick<House, "ownerId">) {
  return Boolean(user?.role === "admin" || canManageHouse(user, house));
}

export function housePublicHref(houseId: string) {
  return `/houses/${houseId}`;
}

export function houseManagerHref(houseId: string, section?: ManagerHouseSection) {
  return `/dashboard/houses/${houseId}${section ? managerSectionHash[section] : ""}`;
}

export function houseContractsHref(houseId: string) {
  return `/contrats?house=${houseId}`;
}

export function houseDetailHref(house: Pick<House, "id" | "ownerId">, user?: HouseLinkUser, section?: ManagerHouseSection) {
  return canInspectHouse(user, house)
    ? houseManagerHref(house.id, section)
    : housePublicHref(house.id);
}

export function houseContractHref(house: Pick<House, "id">) {
  return houseContractsHref(house.id);
}
