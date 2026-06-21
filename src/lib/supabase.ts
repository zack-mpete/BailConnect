import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const requestTimeoutMs = 4500;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: init?.signal || controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

const clientOptions = {
  global: {
    fetch: fetchWithTimeout
  }
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, clientOptions)
  : null;

export function createPublicSupabaseClient(accessToken?: string) {
  if (!isSupabaseConfigured) return null;

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: fetchWithTimeout,
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`
          }
        : undefined
    }
  });
}
