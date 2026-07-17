"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);

  function destination(role: NonNullable<typeof user>["role"]) {
    const requestedRoute = new URLSearchParams(window.location.search).get("next");
    return postAuthRoute(role, requestedRoute);
  }

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(destination(user.role));
    }
  // The URL is read only when the authenticated user changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, router, user]);

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

        toast.success("Connexion réussie.");
        router.replace(destination(currentUser.role));
        router.refresh();
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

      toast.success("Compte créé.");
      router.replace(destination(currentUser.role));
      router.refresh();
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
        <Card className="w-full space-y-5">
          <div>
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
      </section>
    </main>
  );
}
