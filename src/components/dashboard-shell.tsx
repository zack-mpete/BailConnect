"use client";

import dynamic from "next/dynamic";
import { RoleGate } from "@/components/role-gate";
import type { AppData } from "@/types";

const AdminDashboard = dynamic(() => import("@/components/admin-dashboard").then(mod => mod.AdminDashboard), {
  loading: () => <div className="rounded-2xl bg-white p-5 text-sm font-semibold text-muted shadow-card">Chargement du centre de contrôle...</div>
});

const UserDashboard = dynamic(() => import("@/components/user-dashboard").then(mod => mod.UserDashboard), {
  loading: () => <div className="rounded-2xl bg-ink p-5 text-sm font-semibold text-white/70">Chargement de l'espace...</div>
});

export function DashboardShell({ data }: { data: AppData }) {
  return (
    <RoleGate allow={["admin", "bailleur", "agence", "locataire"]} fallbackText="Connecte-toi pour ouvrir ton tableau de bord.">
      <h1 className="text-3xl font-black">Dashboards</h1>
      <p className="mt-2 text-muted">Chaque rôle voit les actions adaptées à son espace.</p>
      <div className="mt-6"><AdminDashboard initialData={data} /></div>
      <div className="mt-6"><UserDashboard data={data} /></div>
    </RoleGate>
  );
}
