"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, LayoutDashboard, LogIn, MessageSquare, Search } from "lucide-react";
import { AuthStatus } from "@/components/auth-status";
import { NotificationCenter } from "@/components/notification-center";
import { canOpenDashboard, useCurrentUser } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

const publicItems = [
  ["Accueil", "/", Home],
  ["Chercher", "/search", Search]
] as const;

const roleItems = [
  ["Dashboard", "/dashboard", LayoutDashboard, canOpenDashboard],
  ["Messagerie", "/dashboard?section=messages", MessageSquare, (role?: Role) => canOpenDashboard(role) && role !== "admin"]
] as const;

export function Navbar() {
  const pathname = usePathname();
  const [currentSearch, setCurrentSearch] = useState("");
  const { user } = useCurrentUser();

  useEffect(() => {
    setCurrentSearch(window.location.search);
  }, [pathname]);

  const items = [
    ...publicItems.map(([label, href, Icon]) => ({ label, href, Icon })),
    ...roleItems
      .filter(([, , , allowed]) => user && allowed(user.role))
      .map(([label, href, Icon]) => ({ label, href, Icon }))
  ];
  const visitorMobileItems = [
    ...items,
    { label: "Se connecter", href: "/auth", Icon: LogIn }
  ];
  const mobileItems = user
    ? items.filter(item => ["/", "/search", "/dashboard", "/dashboard?section=messages"].includes(item.href))
    : visitorMobileItems;

  const isActive = (href: string) => {
    const [hrefPath, hrefQuery = ""] = href.split("?");
    const hrefSection = new URLSearchParams(hrefQuery).get("section");
    const currentSection = new URLSearchParams(currentSearch).get("section");

    return pathname === hrefPath && (hrefSection ? currentSection === hrefSection : !currentSection);
  };

  const linkClass = (href: string) =>
    cn(
      "rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950",
      isActive(href) && "bg-slate-100 text-slate-950"
    );

  const markSearch = (href: string) => {
    if (typeof window === "undefined") return;
    setCurrentSearch(new URL(href, window.location.origin).search);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4">
          <Link href="/" className="min-w-0 text-lg font-black tracking-tight md:text-xl">Bail<span className="text-brand-600">Connect</span></Link>
          <div className="hidden items-center gap-2 md:flex">
            {items.map(({ label, href }) => <Link key={href} href={href} onClick={() => markSearch(href)} className={linkClass(href)}>{label}</Link>)}
          </div>
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <AuthStatus />
          </div>
        </div>
      </header>

      <nav className="fixed bottom-3 left-3 right-3 z-50 rounded-2xl border border-white/80 bg-white/95 p-2 shadow-soft backdrop-blur-xl md:hidden">
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(mobileItems.length, 2)}, minmax(0, 1fr))` }}>
          {mobileItems.map(({ label, href, Icon }) => (
            <Link key={href} href={href} onClick={() => markSearch(href)} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-semibold text-slate-600 hover:bg-brand-50 hover:text-brand-700", isActive(href) && "bg-brand-50 text-brand-700")}>
              <Icon size={18}/>
              <span className="max-w-full text-center leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
