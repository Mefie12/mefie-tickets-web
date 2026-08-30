import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

/**
 * POST /api/public/accept/confirm — records the personal-acceptance
 * once. The raw token is not sent; the backend reads the resolved id
 * from the HttpOnly `mefie_accept_flow` cookie set by the
 * `/accept/{token}` entry handler.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const result = await backendRequest("/api/public/accept/confirm", { method: "POST", body });
  return relayResponse(result);
}
