"use client";

import Link from "next/link";
import type { Role } from "@/types";
import { useCurrentUser } from "@/lib/auth-client";
import { Card } from "@/components/ui";

export function RoleGate({
  allow,
  children,
  fallbackTitle = "Accès réservé",
  fallbackText = "Connecte-toi avec un rôle autorisé pour ouvrir cet espace."
}: {
  allow: Role[];
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackText?: string;
}) {
  const { user, loading } = useCurrentUser();

  if (loading) {
    return <Card className="mx-auto mt-10 max-w-xl"><p className="font-bold text-muted">Chargement de ton espace...</p></Card>;
  }

  if (!user || !allow.includes(user.role)) {
    return (
      <Card className="mx-auto mt-10 max-w-xl space-y-4">
        <h1 className="text-2xl font-black">{fallbackTitle}</h1>
        <p className="text-muted">{fallbackText}</p>
        <Link href="/auth" className="inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">Se connecter</Link>
      </Card>
    );
  }

  return <>{children}</>;
}
