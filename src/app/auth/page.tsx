"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Navbar } from "@/components/navbar";
import { Button, Card } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import type { Role } from "@/types";

type Mode = "login" | "signup";

function nextRoute(role: Role) {
  if (role === "bailleur" || role === "agence" || role === "admin") return "/dashboard";
  return "/search";
}

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);

  async function fetchCurrentRole(token: string): Promise<Role> {
    const res = await fetch("/api/users/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });

    if (!res.ok) return "locataire";
    const body = await res.json();
    const role = Array.isArray(body.user?.role) ? body.user.role[0]?.name : body.user?.role?.name;
    return role || "locataire";
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
        const currentRole = token ? await fetchCurrentRole(token) : "locataire";
        if (token) await syncUser(token, {});
        toast.success("Connexion réussie.");
        router.push(nextRoute(currentRole));
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
      toast.success("Compte créé.");
      router.push(nextRoute("locataire"));
      router.refresh();
    } catch (err) {
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
            {mode === "signup" && <input name="full_name" required placeholder="Nom complet" className="w-full rounded-2xl border border-slate-200 px-4 py-3" />}
            <input name="email" type="email" required placeholder="Email" className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
            <input name="password" type="password" required minLength={6} placeholder="Mot de passe" className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
            <Button disabled={loading} className="w-full bg-ink text-white disabled:opacity-60">
              {loading ? "Patiente..." : mode === "login" ? "Se connecter" : "Créer le compte"}
            </Button>
          </form>
        </Card>
      </section>
    </main>
  );
}
