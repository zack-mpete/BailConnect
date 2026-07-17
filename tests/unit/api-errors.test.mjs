import { describe, expect, it } from "vitest";
import { databaseErrorResponse } from "../../src/app/api/_supabase.ts";

describe("codes HTTP des erreurs métier SQL", () => {
  const cases = [
    ["28000", 401],
    ["42501", 403],
    ["P0002", 404],
    ["23505", 409],
    ["23514", 409],
    ["22023", 400]
  ];

  it.each(cases)("mappe %s vers %s", (code, status) => {
    expect(databaseErrorResponse({ code, message: "Erreur test" }).status).toBe(status);
  });
});
