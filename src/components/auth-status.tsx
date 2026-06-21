"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, UserRound } from "lucide-react";
import { useCurrentUser } from "@/lib/auth-client";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function AuthStatus({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  async function logout() {
    await supabase?.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return <div className="h-10 w-28 rounded-full bg-slate-100" />;
  }

  if (!user) {
    return (
      <Link href="/auth" className={cn("inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white", compact && "px-3 text-xs")}>
        <LogIn size={16}/>
        Se connecter
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/dashboard" className={cn("inline-flex min-w-0 items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800", compact && "max-w-[170px]")}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white"><UserRound size={16}/></span>
        <span className="min-w-0">
          <span className="block truncate leading-4">{user.fullName}</span>
          <span className="block text-[11px] font-bold leading-4 text-brand-700">{user.role}</span>
        </span>
      </Link>
      <button onClick={logout} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-card" aria-label="Se déconnecter"><LogOut size={17}/></button>
    </div>
  );
}
