"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Role } from "@/types";

export type CurrentUser = {
  id: string;
  fullName: string;
  email: string | null;
  role: Role;
};

type UserResponse = {
  user: {
    id: string;
    full_name: string;
    email: string | null;
    role?: { name: Role } | { name: Role }[] | null;
  };
};

type AuthContextValue = {
  user: CurrentUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function roleName(role: UserResponse["user"]["role"]): Role {
  if (Array.isArray(role)) return role[0]?.name || "locataire";
  return role?.name || "locataire";
}

function toCurrentUser(body: UserResponse): CurrentUser {
  return {
    id: body.user.id,
    fullName: body.user.full_name,
    email: body.user.email,
    role: roleName(body.user.role)
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!supabase) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setUser(null);
        return;
      }

      const res = await fetch("/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });

      if (!res.ok) {
        setUser(null);
        return;
      }

      const body = (await res.json()) as UserResponse;
      setUser(toCurrentUser(body));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
    const { data } = supabase?.auth.onAuthStateChange((event) => {
      if (event !== "INITIAL_SESSION") refreshUser();
    }) || { data: null };

    return () => {
      data?.subscription.unsubscribe();
    };
  }, [refreshUser]);

  const value = useMemo(() => ({ user, loading, refreshUser }), [loading, refreshUser, user]);

  return createElement(AuthContext.Provider, { value }, children);
}

export function useCurrentUser() {
  const context = useContext(AuthContext);
  if (context) return context;
  return { user: null, loading: true, refreshUser: async () => undefined };
}

export function canPublish(role?: Role) {
  return role === "admin" || role === "bailleur" || role === "agence";
}

export function canOpenDashboard(role?: Role) {
  return role === "admin" || role === "bailleur" || role === "agence" || role === "locataire";
}
