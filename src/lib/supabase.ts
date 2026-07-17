import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const configuredTimeout = Number(process.env.NEXT_PUBLIC_SUPABASE_TIMEOUT_MS);
const requestTimeoutMs = Number.isFinite(configuredTimeout)
  ? Math.min(Math.max(configuredTimeout, 5000), 60000)
  : 15000;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const externalSignal = init?.signal;
  const abortFromExternalSignal = () => controller.abort(externalSignal?.reason);
  const timeout = setTimeout(
    () => controller.abort(new DOMException(`Supabase n'a pas répondu après ${requestTimeoutMs} ms.`, "TimeoutError")),
    requestTimeoutMs
  );

  if (externalSignal?.aborted) {
    abortFromExternalSignal();
  } else {
    externalSignal?.addEventListener("abort", abortFromExternalSignal, { once: true });
  }

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
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

export async function getSupabaseAccessToken() {
  if (!supabase) return null;

  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

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
