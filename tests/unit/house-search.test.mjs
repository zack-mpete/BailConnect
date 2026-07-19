import { describe, expect, it } from "vitest";
import {
  filterHouses,
  getHouseSearchBudgetCeiling
} from "../../src/lib/house-search.ts";

const houses = [
  {
    title: "Villa avec jardin",
    type: "Villa",
    city: "Kinshasa",
    commune: "Gombe",
    district: "Socimat",
    address: "Avenue du Fleuve",
    description: "Maison familiale",
    features: ["Parking", "Jardin"],
    price: 850
  },
  {
    title: "Appartement moderne",
    type: "Appartement",
    city: "Lubumbashi",
    commune: "Kampemba",
    district: "Bel-Air",
    address: null,
    description: "Proche du centre",
    features: ["Balcon"],
    price: 1750
  }
];

describe("recherche des maisons", () => {
  it("recherche dans la localisation, le type et les équipements", () => {
    expect(filterHouses(houses, { query: "socimat", type: "Tous", maxPrice: 2000 })).toEqual([houses[0]]);
    expect(filterHouses(houses, { query: "balcon", type: "Tous", maxPrice: 2000 })).toEqual([houses[1]]);
    expect(filterHouses(houses, { query: "appartement", type: "Appartement", maxPrice: 2000 })).toEqual([houses[1]]);
  });

  it("respecte le budget et inclut les loyers supérieurs à 1200 dans le curseur", () => {
    expect(filterHouses(houses, { query: "", type: "Tous", maxPrice: 1000 })).toEqual([houses[0]]);
    expect(getHouseSearchBudgetCeiling(houses)).toBe(1750);
  });
});
