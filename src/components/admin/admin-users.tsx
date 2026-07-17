"use client";

import { Shield, UserRound } from "lucide-react";
import { Badge } from "@/components/ui";
import type { AppRole, AppUser, Role } from "@/types";

export function AdminUsers({ users, roles, onRoleChange }: { users: AppUser[]; roles: AppRole[]; onRoleChange: (user: AppUser, role: Role) => void }) {
  const roleStyles: Record<Role, string> = {
    admin: "bg-violet-100 text-violet-700",
    bailleur: "bg-cyan-100 text-cyan-700",
    agence: "bg-amber-100 text-amber-700",
    locataire: "bg-emerald-100 text-emerald-700"
  };

  return (
    <div className="surface-card border border-violet-100/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="text-brand-600" size={20} />
          <div>
            <h2 className="text-xl font-black">Utilisateurs et rôles</h2>
            <p className="text-sm text-muted">Gestion des accès administrateur, bailleur, agence et locataire.</p>
          </div>
        </div>
        <Badge>{users.length} comptes</Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {roles.map(role => (
          <span key={role.id} className={`rounded-full px-3 py-1.5 text-xs font-black ${roleStyles[role.name]}`}>
            {role.label} · {users.filter(user => user.role === role.name).length}
          </span>
        ))}
      </div>
      <div className="mt-4 grid max-h-[calc(100vh-220px)] gap-3 overflow-y-auto pr-1 scrollbar-soft">
        {users.map(appUser => (
          <div key={appUser.id} className="grid gap-3 rounded-2xl border border-slate-100 bg-gradient-to-r from-white to-slate-50 p-4 transition hover:border-cyan-200 hover:shadow-card md:grid-cols-[1fr_220px] md:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${roleStyles[appUser.role]}`}><UserRound size={18} /></span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-bold">{appUser.fullName}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${roleStyles[appUser.role]}`}>
                    {appUser.role}
                  </span>
                </div>
                <p className="truncate text-sm text-muted">{appUser.email || "Email non renseigné"}</p>
              </div>
            </div>
            <select value={appUser.role} onChange={event => onRoleChange(appUser, event.target.value as Role)} className="form-control text-sm font-bold">
              {roles.map(role => <option key={role.id} value={role.name}>{role.label}</option>)}
            </select>
          </div>
        ))}
        {!users.length && (
          <p className="rounded-xl bg-slate-50 p-5 text-sm font-semibold text-muted">Aucun utilisateur à afficher.</p>
        )}
      </div>
    </div>
  );
}
