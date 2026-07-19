import type { House } from "@/types";

type SearchableHouse = Pick<
  House,
  "title" | "city" | "commune" | "district" | "address" | "description" | "features" | "type" | "price"
>;

type HouseSearchFilters = {
  query: string;
  type: string;
  maxPrice: number;
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("fr");
}

export function getHouseSearchBudgetCeiling(houses: Array<Pick<House, "price">>) {
  const highestPrice = houses.reduce((highest, house) => Math.max(highest, house.price), 0);
  return Math.max(1200, Math.ceil(highestPrice / 50) * 50);
}

export function filterHouses<T extends SearchableHouse>(
  houses: T[],
  { query, type, maxPrice }: HouseSearchFilters
) {
  const normalizedQuery = normalize(query);

  return houses.filter(house => {
    const searchableText = normalize([
      house.title,
      house.type,
      house.city,
      house.commune,
      house.district || "",
      house.address || "",
      house.description,
      ...house.features
    ].join(" "));
    const matchesText = !normalizedQuery || searchableText.includes(normalizedQuery);
    const matchesType = type === "Tous" || house.type === type;
    return matchesText && matchesType && house.price <= maxPrice;
  });
}
