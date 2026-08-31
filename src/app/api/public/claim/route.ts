import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

/**
 * POST /api/public/claim — the actual claim. The raw claim token is not
 * sent; the backend reads the resolved link id from the HttpOnly
 * `mefie_claim_flow` cookie set by the `/claim/{token}` entry handler.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const result = await backendRequest("/api/public/claim", { method: "POST", body });
  return relayResponse(result);
}
