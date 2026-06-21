import { NextRequest, NextResponse } from "next/server";
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

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
