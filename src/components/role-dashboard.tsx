"use client";

import { Card } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth-client";

const roleCopy = {
  admin: {
    title: "Pilotage administrateur",
    items: ["Validation des utilisateurs", "Modération des annonces", "Suivi global des contrats"]
  },
  bailleur: {
    title: "Espace bailleur",
    items: ["Mes biens publiés", "Demandes reçues", "Contrats à signer"]
  },
  agence: {
    title: "Espace agence",
    items: ["Portefeuille de biens", "Clients et prospects", "Reporting agence"]
  },
  locataire: {
    title: "Espace locataire",
    items: ["Mes recherches", "Mes demandes", "Mes contrats"]
  }
};

export function RoleDashboard() {
  const { user } = useCurrentUser();
  if (!user) return null;

  const content = roleCopy[user.role];

  return (
    <Card className="bg-ink text-white">
      <p className="text-sm font-semibold text-white/60">Connecté comme {user.role}</p>
      <h2 className="mt-2 text-2xl font-black">{content.title}</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {content.items.map(item => <div key={item} className="rounded-2xl bg-white/10 p-4 text-sm font-bold">{item}</div>)}
      </div>
    </Card>
  );
}
