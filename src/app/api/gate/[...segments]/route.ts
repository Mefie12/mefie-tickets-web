import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

/**
 * Gate-device relay. Forwards `/api/gate/*` to Laravel's `/api/gate/*`
 * (the isolated `mefie_gate_session` domain + the `gate.capability`
 * split), carrying the gate session cookie and relaying Set-Cookie back.
 * `POST /api/gate/sessions` (sign-in) is public + throttled on the
 * backend; everything else is behind the session cookie.
 */
type Context = { params: Promise<{ segments: string[] }> };

async function relay(request: NextRequest, context: Context, method: "GET" | "POST" | "DELETE") {
  const { segments } = await context.params;
  const body = method === "GET" ? undefined : await request.json().catch(() => undefined);
  const path = segments.map(encodeURIComponent).join("/");
  return relayResponse(await backendRequest(`/api/gate/${path}${request.nextUrl.search}`, { method, body }));
}

export const GET = (request: NextRequest, context: Context) => relay(request, context, "GET");
export const POST = (request: NextRequest, context: Context) => relay(request, context, "POST");
export const DELETE = (request: NextRequest, context: Context) => relay(request, context, "DELETE");
