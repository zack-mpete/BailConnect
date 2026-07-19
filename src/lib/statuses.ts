import type { ContractStatus, House, RentalRequestStatus } from "@/types";

export const RENTAL_REQUEST_STATUS_LABELS: Record<RentalRequestStatus, string> = {
  en_attente: "En attente",
  approuvee: "Acceptée",
  rejetee: "Refusée",
  annulee: "Annulée"
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  brouillon: "Brouillon",
  pret_a_signer: "Accord partiel",
  signe: "Signé",
  annule: "Annulé",
  resiliation_programmee: "Résiliation programmée",
  resilie: "Résilié"
};

export const ACTIVE_CONTRACT_STATUSES: ContractStatus[] = [
  "brouillon",
  "pret_a_signer",
  "signe",
  "resiliation_programmee"
];

export function isContractActive(status: string): status is ContractStatus {
  return ACTIVE_CONTRACT_STATUSES.includes(status as ContractStatus);
}

export function isPubliclyVisibleHouse(house: {
  isValid: boolean;
  status: string;
  isArchived: boolean;
}) {
  return house.isValid && !house.isArchived && house.status === "Disponible";
}

export function publicationLabel(house: Pick<House, "isValid" | "publicationRejectionReason">) {
  if (house.isValid) return "Validée";
  return house.publicationRejectionReason ? "Rejetée" : "En attente de validation";
}
