"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, BarChart3, FileSignature, Map, RefreshCw, Users } from "lucide-react";
import toast from "react-hot-toast";
import { AdminContracts } from "@/components/admin/admin-contracts";
import { AdminOverview } from "@/components/admin/admin-overview";
import { AdminPublications } from "@/components/admin/admin-publications";
import { AdminUsers } from "@/components/admin/admin-users";
import { DashboardMap } from "@/components/dashboard-map";
import { useCurrentUser } from "@/lib/auth-client";
import { getSupabaseAccessToken } from "@/lib/supabase";
import type { AppData, AppUser, House, Role } from "@/types";

type AdminSection = "overview" | "contracts" | "publications" | "users" | "map";
type PublicationAction = "archive" | "restore" | "approve" | "reject" | "delete";

function isAdminSection(value: string | null): value is AdminSection {
  return value === "overview" || value === "contracts" || value === "publications" || value === "users" || value === "map";
}

const navigation: Array<{ id: AdminSection; label: string; description: string; Icon: typeof BarChart3 }> = [
  { id: "overview", label: "Vue d'ensemble", description: "Indicateurs et activité récente", Icon: BarChart3 },
  { id: "contracts", label: "Contrats", description: "Liste des contrats et accords", Icon: FileSignature },
  { id: "publications", label: "Publications", description: "Liste et modération des annonces", Icon: Archive },
  { id: "users", label: "Utilisateurs", description: "Liste des comptes et rôles", Icon: Users },
  { id: "map", label: "Map", description: "Biens et zones actives", Icon: Map }
];

export function AdminDashboard({ initialData }: { initialData: AppData }) {
  const { user } = useCurrentUser();
  const [data, setData] = useState<AppData>(initialData);
  const [section, setSection] = useState<AdminSection>("overview");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (user?.role !== "admin") return;
    const token = await getSupabaseAccessToken();
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Chargement admin impossible.");
      setData(body);
    } catch (err) {
      console.error("[admin-dashboard] Actualisation impossible.", {
        name: err instanceof Error ? err.name : "UnknownError",
        message: err instanceof Error ? err.message : String(err)
      });
      toast.error(err instanceof Error ? err.message : "Chargement admin impossible.");
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const syncSectionFromUrl = () => {
      const nextSection = new URLSearchParams(window.location.search).get("section");
      setSection(isAdminSection(nextSection) ? nextSection : "overview");
    };

    syncSectionFromUrl();
    window.addEventListener("popstate", syncSectionFromUrl);
    return () => window.removeEventListener("popstate", syncSectionFromUrl);
  }, []);

  function selectSection(nextSection: AdminSection) {
    setSection(nextSection);
    const url = new URL(window.location.href);
    if (nextSection === "overview") {
      url.searchParams.delete("section");
    } else {
      url.searchParams.set("section", nextSection);
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function sectionCount(target: AdminSection) {
    if (target === "contracts") return data.contracts.length;
    if (target === "publications" || target === "map") return data.houses.length;
    if (target === "users") return data.users.length;
    return null;
  }

  async function updateHouse(house: House, action: PublicationAction, reason?: string) {
    const token = await getSupabaseAccessToken();
    if (!token) return;

    const res = await fetch(`/api/houses/${house.id}`, {
      method: action === "delete" ? "DELETE" : "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: action === "delete" ? undefined : JSON.stringify({ action, reason })
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("[admin-dashboard] Action publication impossible.", {
        houseId: house.id,
        action,
        status: res.status,
        error: body?.error || null
      });
      toast.error(body?.error || "Action impossible.");
      return;
    }

    toast.success(
      action === "delete"
        ? "Publication supprimée."
        : action === "approve"
          ? "Publication validée."
          : action === "reject"
            ? "Publication rejetée."
            : "Publication mise à jour."
    );
    await refresh();
  }

  async function updateUserRole(appUser: AppUser, role: Role) {
    const token = await getSupabaseAccessToken();
    if (!token) return;

    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ user_id: appUser.id, role })
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(body?.error || "Rôle impossible à modifier.");
      return;
    }

    toast.success("Rôle utilisateur mis à jour.");
    await refresh();
  }

  async function finalizeTermination(contractId: string) {
    const token = await getSupabaseAccessToken();
    if (!token) return;

    const response = await fetch("/api/contracts", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ contract_id: contractId, action: "finalize_termination" })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error(body?.error || "Finalisation impossible.");
      return;
    }
    toast.success("Résiliation finalisée.");
    await refresh();
  }

  if (user?.role !== "admin") return null;

  return (
    <section className="min-w-0 rounded-2xl bg-gradient-to-br from-slate-100 via-cyan-50/60 to-white p-1.5 min-[360px]:p-2 md:p-3 lg:h-[calc(100dvh-104px)] lg:overflow-hidden">
      <div className="grid gap-3 lg:h-full lg:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-cyan-950 p-4 text-white shadow-soft lg:h-full lg:overflow-y-auto lg:overscroll-contain scrollbar-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-white/50">Admin</p>
              <h2 className="mt-1 text-xl font-black">Centre de contrôle</h2>
            </div>
            <button onClick={refresh} disabled={loading} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-50" aria-label="Actualiser">
              <RefreshCw size={17} />
            </button>
          </div>
          <nav className="mt-6 flex snap-x gap-2 overflow-x-auto pb-2 scrollbar-soft lg:grid lg:overflow-visible lg:pb-0">
            {navigation.map(({ id, label, description, Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={section === id}
                onClick={() => selectSection(id)}
                className={`flex min-w-[172px] snap-start items-center gap-3 rounded-2xl p-3 text-left transition min-[390px]:min-w-[190px] lg:min-w-0 ${section === id ? "bg-white text-ink shadow-card" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${section === id ? "bg-brand-50 text-brand-700" : "bg-white/10"}`}><Icon size={18} /></span>
                <span className="min-w-0">
                  <span className="flex items-center justify-between gap-2 text-sm font-black">
                    <span>{label}</span>
                    {sectionCount(id) !== null && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${section === id ? "bg-slate-100 text-slate-700" : "bg-white/10 text-white"}`}>
                        {sectionCount(id)}
                      </span>
                    )}
                  </span>
                  <span className={`block text-xs ${section === id ? "text-slate-500" : "text-white/45"}`}>{description}</span>
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 rounded-2xl bg-white/70 p-2 shadow-inner backdrop-blur-sm md:p-3 lg:h-full lg:overflow-y-auto lg:overscroll-contain scrollbar-soft">
          <div key={section} className="animate-[fadeIn_.2s_ease-out]">
            {section === "overview" && <AdminOverview data={data} />}
            {section === "contracts" && <AdminContracts contracts={data.contracts} onFinalize={contract => finalizeTermination(contract.id)} />}
            {section === "publications" && <AdminPublications houses={data.houses} onAction={updateHouse} />}
            {section === "users" && <AdminUsers users={data.users} roles={data.roles} onRoleChange={updateUserRole} />}
            {section === "map" && <DashboardMap houses={data.houses} title="Vue map plateforme" subtitle="Répartition des annonces, statuts et zones actives." />}
          </div>
        </div>
      </div>
    </section>
  );
}
