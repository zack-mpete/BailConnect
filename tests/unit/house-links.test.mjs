import { describe, expect, it } from "vitest";
import {
  canInspectHouse,
  canManageHouse,
  houseContractHref,
  houseDetailHref
} from "../../src/lib/house-links.ts";

const house = { id: "house-1", ownerId: "owner-1" };

describe("navigation par rôle", () => {
  it("réserve la gestion au bailleur ou à l'agence propriétaire", () => {
    expect(canManageHouse({ id: "owner-1", role: "bailleur" }, house)).toBe(true);
    expect(canManageHouse({ id: "owner-1", role: "agence" }, house)).toBe(true);
    expect(canManageHouse({ id: "owner-1", role: "admin" }, house)).toBe(false);
    expect(canManageHouse({ id: "tenant-1", role: "locataire" }, house)).toBe(false);
  });

  it("donne à l'administrateur un détail privé en lecture seule", () => {
    expect(canInspectHouse({ id: "admin-1", role: "admin" }, house)).toBe(true);
    expect(houseDetailHref(house, { id: "admin-1", role: "admin" }))
      .toBe("/dashboard/houses/house-1");
    expect(houseDetailHref(house, { id: "tenant-1", role: "locataire" }))
      .toBe("/houses/house-1");
  });

  it("ouvre toujours le composant de contrat réel", () => {
    expect(houseContractHref(house)).toBe("/contrats?house=house-1");
  });
});
