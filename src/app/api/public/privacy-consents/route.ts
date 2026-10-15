import { NextRequest, NextResponse } from "next/server";
import { backendRequest } from "@/lib/backend";

/**
 * POST /api/public/privacy-consents — proof of a visitor's privacy choice
 * (docs/26, Phase 2b). Relays to the API, which stores the choice with a
 * random anonymous id and nothing else. Deliberately does NOT relay the API's
 * Set-Cookie headers (unlike relayResponse): recording consent must never
 * start a session or set any cookie on the visitor.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const result = await backendRequest("/api/public/privacy-consents", { method: "POST", body });
  return NextResponse.json(result.data ?? {}, { status: result.status });
}
