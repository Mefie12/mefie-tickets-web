import { NextRequest } from "next/server";
import { backendRequestResilient } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

/**
 * POST /api/public/claim — the actual claim. The raw claim token is not
 * sent; the backend reads the resolved link id from the HttpOnly
 * `mefie_claim_flow` cookie set by the `/claim/{token}` entry handler.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const result = await backendRequestResilient("/api/public/claim", { method: "POST", body });
  const response = relayResponse(result, { structuredErrors: true });
  // The API keeps the flow cookie so a failed delivery can be retried safely; drop the preview so a reload
  // does not show the form again after a successful claim.
  if (result.status === 200) response.cookies.delete("mefie_claim_preview");
  return response;
}
