"use client";

import { Shield, UserRound } from "lucide-react";
import { Badge } from "@/components/ui";
import type { AppRole, AppUser, Role } from "@/types";

export function AdminUsers({ users, roles, onRoleChange }: { users: AppUser[]; roles: AppRole[]; onRoleChange: (user: AppUser, role: Role) => void }) {
  return (
    <div className="surface-card">
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
      <div className="mt-4 grid max-h-[calc(100vh-220px)] gap-3 overflow-y-auto pr-1 scrollbar-soft">
        {users.map(appUser => (
          <div key={appUser.id} className="grid gap-3 soft-panel md:grid-cols-[1fr_220px] md:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white"><UserRound size={18} /></span>
              <div className="min-w-0">
                <p className="truncate font-bold">{appUser.fullName}</p>
                <p className="truncate text-sm text-muted">{appUser.email || "Email non renseigné"}</p>
              </div>
            </div>
            <select value={appUser.role} onChange={event => onRoleChange(appUser, event.target.value as Role)} className="form-control text-sm font-bold">
              {roles.map(role => <option key={role.id} value={role.name}>{role.label}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
