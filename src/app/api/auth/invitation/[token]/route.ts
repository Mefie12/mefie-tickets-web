import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

/** Unauthenticated preview — lets the accept page branch on requires_login. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await backendRequest(`/api/auth/invitation/${encodeURIComponent(token)}`, { method: "GET" });
  return relayResponse(result);
}

/**
 * Works both unauthenticated (new email — body carries name+password) and
 * authenticated (existing email already logged in as that address — no
 * body at all), so the body is read leniently rather than assumed
 * present.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await request.json().catch(() => undefined);
  const result = await backendRequest(`/api/auth/invitation/${encodeURIComponent(token)}`, {
    method: "POST",
    body,
  });
  return relayResponse(result);
}
