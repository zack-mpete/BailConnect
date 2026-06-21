"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth-client";
import { supabase } from "@/lib/supabase";

export function ContractCta({ houseId }: { houseId: string }) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [submitting, setSubmitting] = useState(false);

  async function requestContract() {
    if (!user) {
      router.push("/auth");
      return;
    }
    if (!supabase) {
      toast.error("Supabase n'est pas configuré.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      router.push("/auth");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/rental-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          house_id: houseId,
          message: "Je souhaite louer ce logement et recevoir un contrat."
        })
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Demande impossible.");

      toast.success("Demande envoyée au bailleur.");
      router.push(`/contrats?house=${houseId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demande impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <Button disabled className="w-full bg-ink text-white opacity-60">Chargement...</Button>;
  }

  return (
    <Button onClick={requestContract} disabled={submitting} className="w-full bg-ink text-white disabled:opacity-60">
      {user ? submitting ? "Envoi..." : "Demander un contrat" : "Se connecter pour demander un contrat"}
    </Button>
  );
}
