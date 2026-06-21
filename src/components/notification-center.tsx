"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { useCurrentUser } from "@/lib/auth-client";
import { supabase } from "@/lib/supabase";

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  read_at: string | null;
  created_at: string;
};

async function getToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export function NotificationCenter() {
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  const unreadCount = useMemo(() => notifications.filter(item => !item.read_at).length, [notifications]);

  const refresh = useCallback(async () => {
    if (!user) return;
    const token = await getToken();
    if (!token) return;

    const res = await fetch("/api/notifications", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    if (!res.ok) return;
    const body = await res.json().catch(() => null);
    setNotifications(body?.notifications || []);
  }, [user]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function markRead(id: string) {
    const token = await getToken();
    if (!token) return;
    setNotifications(current => current.map(item => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ notification_id: id })
    });
  }

  if (!user) return null;

  return (
    <div className="relative">
      <button onClick={() => setOpen(value => !value)} className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-700" aria-label="Notifications">
        <Bell size={17} />
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-black text-white">{unreadCount}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft">
          <div className="border-b border-slate-100 p-4">
            <p className="font-black">Notifications</p>
            <p className="text-xs font-semibold text-muted">{unreadCount} non lue{unreadCount > 1 ? "s" : ""}</p>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm font-semibold text-muted">Aucune notification pour le moment.</p>
            ) : (
              notifications.map(item => (
                <Link
                  key={item.id}
                  href={item.url || "/dashboard"}
                  onClick={() => {
                    setOpen(false);
                    markRead(item.id);
                  }}
                  className={`block rounded-xl p-3 text-sm hover:bg-slate-50 ${item.read_at ? "opacity-65" : "bg-brand-50/60"}`}
                >
                  <p className="font-black">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{item.body}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
