import type { ContractStatus, PublicationStatus, RentalRequestStatus } from "@/types";

export const PUBLICATION_STATUS_LABELS: Record<PublicationStatus, string> = {
  en_attente: "En attente de validation",
  validee: "Validée",
  rejetee: "Rejetée"
};

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
  publicationStatus: PublicationStatus;
  status: string;
  isArchived: boolean;
}) {
  return !house.isArchived && house.publicationStatus === "validee" && house.status === "Disponible";
}
