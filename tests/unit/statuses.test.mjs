import { describe, expect, it } from "vitest";
import {
  ACTIVE_CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  isContractActive,
  isPubliclyVisibleHouse
} from "../../src/lib/statuses.ts";

describe("règles de visibilité des annonces", () => {
  it("affiche uniquement une annonce validée et disponible", () => {
    expect(isPubliclyVisibleHouse({ isValid: true, status: "Disponible", isArchived: false })).toBe(true);
    expect(isPubliclyVisibleHouse({ isValid: false, status: "Disponible", isArchived: false })).toBe(false);
    expect(isPubliclyVisibleHouse({ isValid: true, status: "Réservé", isArchived: false })).toBe(false);
    expect(isPubliclyVisibleHouse({ isValid: true, status: "Loué", isArchived: false })).toBe(false);
    expect(isPubliclyVisibleHouse({ isValid: true, status: "Disponible", isArchived: true })).toBe(false);
  });
});

describe("cycle des contrats", () => {
  it("centralise les statuts qui bloquent un second contrat", () => {
    expect(ACTIVE_CONTRACT_STATUSES).toEqual([
      "brouillon",
      "pret_a_signer",
      "signe",
      "resiliation_programmee"
    ]);
    expect(isContractActive("signe")).toBe(true);
    expect(isContractActive("resiliation_programmee")).toBe(true);
    expect(isContractActive("resilie")).toBe(false);
    expect(isContractActive("annule")).toBe(false);
  });

  it("possède un libellé pour chaque nouveau statut de résiliation", () => {
    expect(CONTRACT_STATUS_LABELS.resiliation_programmee).toBe("Résiliation programmée");
    expect(CONTRACT_STATUS_LABELS.resilie).toBe("Résilié");
  });
});
