"use client";

import { Bell } from "lucide-react";
import { useCurrentUser } from "@/lib/auth-client";
import { getSupabaseAccessToken, supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

async function getActiveServiceWorkerRegistration() {
  const registration = await navigator.serviceWorker.register("/sw.js");

  if (registration.active) return registration;

  const installingWorker = registration.installing || registration.waiting;
  if (!installingWorker) return await navigator.serviceWorker.ready;
  const worker = installingWorker;

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      worker.removeEventListener("statechange", handleStateChange);
      reject(new Error("Service worker non activÃ©."));
    }, 10000);

    function handleStateChange() {
      if (worker.state === "activated") {
        window.clearTimeout(timeout);
        worker.removeEventListener("statechange", handleStateChange);
        resolve();
      }
    }

    worker.addEventListener("statechange", handleStateChange);
    handleStateChange();
  });

  return await navigator.serviceWorker.ready;
}

export function WebPushButton() {
  const { user, loading } = useCurrentUser();

  async function enablePush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast.error("Web Push non supporté sur ce navigateur.");
      return;
    }

    if (!supabase) {
      toast.error("Supabase n'est pas configuré.");
      return;
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      toast.error("Clé publique VAPID manquante.");
      return;
    }

    const token = await getSupabaseAccessToken();
    if (!token) {
      toast.error("Connecte-toi avant d'activer les notifications.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      toast.error("Permission refusée.");
      return;
    }

    const registration = await getActiveServiceWorkerRegistration();
    const subscription =
      (await registration.pushManager.getSubscription()) ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      }));

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(subscription)
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error || "Notifications impossibles.");
      return;
    }

    toast.success("Notifications activées.");
  }

  if (loading || !user) return null;

  return <button onClick={enablePush} className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-sm font-bold text-brand-700"><Bell size={16}/> Activer Web Push</button>;
}
