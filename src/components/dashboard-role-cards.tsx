"use client";

import { Card } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth-client";

type DashboardRoleCard = {
  name: string;
  desc: string;
};

export function DashboardRoleCards({ roles }: { roles: DashboardRoleCard[] }) {
  const { user } = useCurrentUser();
  if (user?.role === "admin") return null;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {roles.map(role => (
        <Card key={role.name} className="bg-white/80">
          <h2 className="font-black">{role.name}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{role.desc}</p>
        </Card>
      ))}
    </div>
  );
}
