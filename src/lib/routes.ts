import type { Role } from "@/types";

export const routes = {
  home: "/",
  search: "/search",
  auth: "/auth",
  dashboard: "/dashboard",
  contracts: "/contrats",
  addHouse: "/add-house"
} as const;

function pathOnly(value: string) {
  return value.split(/[?#]/, 1)[0] || "/";
}

export function isKnownAppRoute(value: string | null | undefined): value is string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return false;

  const pathname = pathOnly(value);
  if (Object.values(routes).includes(pathname as (typeof routes)[keyof typeof routes])) return true;

  const segments = pathname.split("/").filter(Boolean);
  return (
    (segments.length === 2 && segments[0] === "houses" && Boolean(segments[1])) ||
    (segments.length === 3 && segments[0] === "dashboard" && segments[1] === "houses" && Boolean(segments[2]))
  );
}

export function defaultRouteForRole(role: Role) {
  return role === "locataire" ? routes.search : routes.dashboard;
}

export function canRoleOpenRoute(role: Role, value: string) {
  const pathname = pathOnly(value);
  if (pathname === routes.addHouse) return role === "admin" || role === "bailleur" || role === "agence";
  if (pathname.startsWith("/dashboard/houses/")) return role === "admin" || role === "bailleur" || role === "agence";
  return pathname !== routes.auth;
}

export function postAuthRoute(role: Role, requestedRoute?: string | null) {
  if (!requestedRoute || !isKnownAppRoute(requestedRoute) || !canRoleOpenRoute(role, requestedRoute)) {
    return defaultRouteForRole(role);
  }

  const url = new URL(requestedRoute, "https://bailconnect.local");
  if (url.pathname === routes.dashboard) {
    const section = url.searchParams.get("section");
    const validSections = role === "admin"
      ? ["overview", "contracts", "publications", "users", "map"]
      : ["overview", "payments", "properties", "contracts", "messages", "map"];
    if (section && !validSections.includes(section)) return defaultRouteForRole(role);
  }

  return requestedRoute;
}

export function loginHref(returnTo?: string | null) {
  return returnTo && isKnownAppRoute(returnTo)
    ? `${routes.auth}?next=${encodeURIComponent(returnTo)}`
    : routes.auth;
}
