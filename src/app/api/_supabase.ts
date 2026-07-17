import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createPublicSupabaseClient } from "@/lib/supabase";

export function getBearerToken(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
}

export function getApiClient(req?: NextRequest) {
  const client = createPublicSupabaseClient(req ? getBearerToken(req) : undefined);
  if (!client) {
    return {
      client: null,
      error: NextResponse.json({ error: "Supabase n'est pas configuré." }, { status: 503 })
    };
  }

  return { client, error: null };
}

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      cause: error.cause instanceof Error ? error.cause.message : undefined
    };
  }

  if (error && typeof error === "object") {
    const record = error as { name?: unknown; message?: unknown; code?: unknown; cause?: unknown };
    const cause = record.cause && typeof record.cause === "object"
      ? record.cause as { code?: unknown; message?: unknown }
      : null;

    return {
      name: typeof record.name === "string" ? record.name : undefined,
      message: typeof record.message === "string" ? record.message : undefined,
      code: record.code,
      causeCode: cause?.code,
      cause: typeof cause?.message === "string" ? cause.message : undefined
    };
  }

  return { message: String(error) };
}

export function isSupabaseNetworkError(error: unknown) {
  const details = errorDetails(error);
  const message = `${details.name || ""} ${details.message || ""} ${details.cause || ""} ${details.code || ""} ${details.causeCode || ""}`.toLowerCase();

  return (
    message.includes("abort") ||
    message.includes("timeout") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("enotfound") ||
    message.includes("eai_again") ||
    message.includes("etimedout")
  );
}

export function authFailureResponse(context: string, error: unknown) {
  const details = errorDetails(error);
  console.error(context, details);

  if (isSupabaseNetworkError(error)) {
    return apiError("Supabase est momentanément inaccessible.", 503);
  }

  return apiError("Connexion requise.", 401);
}

export async function getAuthenticatedUser(client: SupabaseClient, context: string): Promise<
  | { user: User; errorResponse: null }
  | { user: null; errorResponse: NextResponse }
> {
  const { data, error } = await client.auth.getUser().catch(error => ({
    data: { user: null },
    error
  }));

  if (error || !data.user) {
    return {
      user: null,
      errorResponse: authFailureResponse(context, error)
    };
  }

  return {
    user: data.user,
    errorResponse: null
  };
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
