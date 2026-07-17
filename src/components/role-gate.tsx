"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Role } from "@/types";
import { useCurrentUser } from "@/lib/auth-client";
import { loginHref } from "@/lib/routes";
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
  const pathname = usePathname();
  const { user, loading } = useCurrentUser();
  const [returnTo, setReturnTo] = useState(pathname);

  useEffect(() => {
    setReturnTo(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  }, [pathname]);

  if (loading) {
    return <Card className="mx-auto mt-10 max-w-xl"><p className="font-bold text-muted">Chargement de ton espace...</p></Card>;
  }

  if (!user || !allow.includes(user.role)) {
    return (
      <Card className="mx-auto mt-10 max-w-xl space-y-4">
        <h1 className="text-2xl font-black">{fallbackTitle}</h1>
        <p className="text-muted">{fallbackText}</p>
        <Link href={loginHref(returnTo)} className="inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">Se connecter</Link>
      </Card>
    );
  }

  return <>{children}</>;
}
