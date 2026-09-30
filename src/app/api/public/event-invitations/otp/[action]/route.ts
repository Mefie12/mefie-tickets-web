import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

/**
 * OTP request/verify for the event-invitation flow. The raw invite
 * token never touches these calls — the backend reads it from the
 * HttpOnly `mefie_invite_flow` cookie set by the `/invite/{token}` entry
 * handler. `verify` returns a `mefie_consumer_session` cookie on
 * success, which relayResponse() forwards to the browser.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action !== "request" && action !== "verify") {
    return new Response("Not found", { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  const result = await backendRequest(`/api/public/event-invitations/otp/${action}`, { method: "POST", body });
  return relayResponse(result);
}
