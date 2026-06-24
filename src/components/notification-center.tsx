"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useCurrentUser } from "@/lib/auth-client";
import { getSupabaseAccessToken } from "@/lib/supabase";

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationCenter() {
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [notificationsAvailable, setNotificationsAvailable] = useState(true);
  const knownNotificationIds = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);
  const lastSoundAt = useRef(0);

  const unreadCount = useMemo(() => notifications.filter(item => !item.read_at).length, [notifications]);

  const playNotificationSound = useCallback(() => {
    const now = Date.now();
    if (now - lastSoundAt.current < 1500) return;
    lastSoundAt.current = now;

    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      oscillator.frequency.setValueAtTime(660, context.currentTime + 0.11);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.3);
      window.setTimeout(() => context.close().catch(() => undefined), 450);
    } catch {
      // Browsers can block audio until the user interacts with the page.
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!user || !notificationsAvailable) return;
    const token = await getSupabaseAccessToken();
    if (!token) return;

    const res = await fetch("/api/notifications", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    if (!res.ok) return;
    const body = await res.json().catch(() => null);
    if (body?.notifications_available === false) {
      setNotifications([]);
      setNotificationsAvailable(false);
      return;
    }
    const nextNotifications = (body?.notifications || []) as NotificationRow[];
    const hasNewUnread = nextNotifications.some(item => !item.read_at && !knownNotificationIds.current.has(item.id));
    knownNotificationIds.current = new Set(nextNotifications.map(item => item.id));
    if (initialLoadDone.current && hasNewUnread) playNotificationSound();
    initialLoadDone.current = true;
    setNotifications(nextNotifications);
  }, [notificationsAvailable, playNotificationSound, user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setNotificationsAvailable(true);
      knownNotificationIds.current = new Set();
      initialLoadDone.current = false;
      return;
    }

    if (!notificationsAvailable) return;

    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [notificationsAvailable, refresh, user]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== "bailconnect-notification") return;
      playNotificationSound();
      refresh();
    }

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [playNotificationSound, refresh]);

  async function markRead(id: string) {
    const token = await getSupabaseAccessToken();
    if (!token) return;
    setNotifications(current => current.map(item => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ notification_id: id })
    });
    const body = await res.json().catch(() => null);
    if (body?.notifications_available === false) setNotificationsAvailable(false);
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
