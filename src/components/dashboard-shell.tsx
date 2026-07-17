"use client";

import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { RoleGate } from "@/components/role-gate";
import type { AppData } from "@/types";

const AdminDashboard = dynamic(() => import("@/components/admin-dashboard").then(mod => mod.AdminDashboard), {
  loading: () => <div className="rounded-2xl bg-white p-5 text-sm font-semibold text-muted shadow-card">Chargement du centre de contrôle...</div>
});

const UserDashboard = dynamic(() => import("@/components/user-dashboard").then(mod => mod.UserDashboard), {
  loading: () => <div className="rounded-2xl bg-ink p-5 text-sm font-semibold text-white/70">Chargement de l'espace...</div>
});

export function DashboardShell({ data }: { data: AppData }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: reduceMotion ? 0 : 18, scale: reduceMotion ? 1 : 0.992 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: reduceMotion ? 0.15 : 0.48, ease: [0.22, 1, 0.36, 1] }}
    >
      <RoleGate allow={["admin", "bailleur", "agence", "locataire"]} fallbackText="Connecte-toi pour ouvrir ton tableau de bord.">
        <AdminDashboard initialData={data} />
        <UserDashboard data={data} />
      </RoleGate>
    </motion.div>
  );
}
