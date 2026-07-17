"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, KeyRound } from "lucide-react";
import toast from "react-hot-toast";
import { Navbar } from "@/components/navbar";
import { Button, Card } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth-client";
import { postAuthRoute } from "@/lib/routes";
import { supabase } from "@/lib/supabase";

type Mode = "login" | "signup";

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    };
  }

  return { message: String(error) };
}

export default function AuthPage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useCurrentUser();
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionName, setTransitionName] = useState("");

  function destination(role: NonNullable<typeof user>["role"]) {
    const requestedRoute = new URLSearchParams(window.location.search).get("next");
    return postAuthRoute(role, requestedRoute);
  }

  useEffect(() => {
    if (!authLoading && user && !loading && !transitioning) {
      router.replace(destination(user.role));
    }
  // The URL is read only when the authenticated user changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, loading, router, transitioning, user]);

  async function openDashboard(currentUser: NonNullable<typeof user>, successMessage: string) {
    const target = destination(currentUser.role);
    router.prefetch(target);
    setTransitionName(currentUser.fullName);
    setTransitioning(true);
    toast.success(successMessage);

    await new Promise(resolve => window.setTimeout(resolve, reduceMotion ? 120 : 950));
    router.replace(target);
    router.refresh();
  }

  async function syncUser(token: string, payload: { full_name?: string }) {
    const res = await fetch("/api/users/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      console.error("[auth] Synchronisation du profil impossible.", {
        status: res.status,
        error: body?.error || "Réponse API invalide"
      });
      throw new Error(body?.error || "Synchronisation utilisateur impossible.");
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) {
      toast.error("Supabase n'est pas configuré.");
      return;
    }

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    const fullName = String(form.get("full_name") || "");

    setLoading(true);
    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const token = data.session?.access_token;
        if (!token) throw new Error("La session de connexion n'a pas été créée.");

        await syncUser(token, {});
        const currentUser = await refreshUser();
        if (!currentUser) throw new Error("Impossible de charger ton profil après la connexion.");

        await openDashboard(currentUser, "Connexion réussie.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });

      if (error) throw error;

      const token = data.session?.access_token;
      if (!token) {
        toast.success("Compte créé. Connecte-toi maintenant.");
        setMode("login");
        return;
      }

      await syncUser(token, { full_name: fullName });
      const currentUser = await refreshUser();
      if (!currentUser) throw new Error("Impossible de charger ton profil après l'inscription.");

      await openDashboard(currentUser, "Compte créé.");
    } catch (err) {
      console.error(`[auth] Échec du flux ${mode}.`, errorDetails(err));
      toast.error(err instanceof Error ? err.message : "Opération impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <Navbar />
      <section className="mx-auto flex min-h-[80vh] max-w-md items-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: reduceMotion ? 0 : 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.35, ease: "easeOut" }}
          className="w-full"
        >
        <Card className="w-full space-y-5 border border-cyan-100/70 bg-white/90 backdrop-blur">
          <div>
            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
              <KeyRound size={20} />
            </span>
            <h1 className="text-3xl font-black">{mode === "login" ? "Connexion" : "Créer un compte"}</h1>
            <p className="mt-2 text-sm text-muted">{mode === "login" ? "Accède à ton espace BailConnect." : "Crée ton compte locataire. Un administrateur pourra modifier tes accès ensuite."}</p>
          </div>
          <div className="grid grid-cols-2 rounded-full bg-slate-100 p-1">
            <button type="button" onClick={() => setMode("login")} className={`rounded-full px-4 py-2 text-sm font-bold ${mode === "login" ? "bg-white shadow-card" : "text-muted"}`}>Login</button>
            <button type="button" onClick={() => setMode("signup")} className={`rounded-full px-4 py-2 text-sm font-bold ${mode === "signup" ? "bg-white shadow-card" : "text-muted"}`}>Inscription</button>
          </div>
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && <input name="full_name" required placeholder="Nom complet" className="form-control" />}
            <input name="email" type="email" required placeholder="Email" className="form-control" />
            <input name="password" type="password" required minLength={6} placeholder="Mot de passe" className="form-control" />
            <Button disabled={loading} className="w-full bg-ink text-white disabled:opacity-60">
              {loading ? "Patiente..." : mode === "login" ? "Se connecter" : "Créer le compte"}
            </Button>
          </form>
        </Card>
        </motion.div>
      </section>
      <AnimatePresence>
        {transitioning && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-950 px-5 text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22 }}
            role="status"
            aria-live="polite"
          >
            <motion.div
              className="absolute h-[420px] w-[420px] rounded-full bg-cyan-500/20 blur-3xl"
              initial={{ scale: 0.65, opacity: 0 }}
              animate={{ scale: 1.15, opacity: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.9, ease: "easeOut" }}
            />
            <motion.div
              className="relative w-full max-w-sm text-center"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 18, scale: reduceMotion ? 1 : 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: reduceMotion ? 0 : 0.12, duration: reduceMotion ? 0 : 0.38 }}
            >
              <motion.span
                className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-emerald-600 shadow-soft"
                initial={{ rotate: reduceMotion ? 0 : -12, scale: reduceMotion ? 1 : 0.7 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ delay: reduceMotion ? 0 : 0.16, type: "spring", stiffness: 220, damping: 16 }}
              >
                <CheckCircle2 size={38} strokeWidth={2.5} />
              </motion.span>
              <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Connexion sécurisée</p>
              <h2 className="mt-2 text-2xl font-black">Bienvenue, {transitionName}</h2>
              <p className="mt-2 text-sm text-white/60">Préparation de ton espace BailConnect…</p>
              <div className="mx-auto mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: reduceMotion ? 0.1 : 0.75, ease: "easeInOut" }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
