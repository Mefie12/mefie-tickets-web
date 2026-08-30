import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

/**
 * Consumer-portal relay. Every `/api/portal/*` call the browser makes is
 * forwarded 1:1 to Laravel's `/api/portal/*` (the `consumer.session`
 * guard), carrying the browser's `mefie_consumer_session` cookie via
 * backendRequest() and relaying Laravel's Set-Cookie back. Step-up
 * (`consumer.stepup`) routes ride the same session cookie — the guard
 * checks OTP freshness server-side.
 */
type Context = { params: Promise<{ segments: string[] }> };

async function relay(request: NextRequest, context: Context, method: "GET" | "POST" | "DELETE") {
  const { segments } = await context.params;
  const body = method === "GET" ? undefined : await request.json().catch(() => undefined);
  const path = segments.map(encodeURIComponent).join("/");
  return relayResponse(await backendRequest(`/api/portal/${path}${request.nextUrl.search}`, { method, body }));
}

export const GET = (request: NextRequest, context: Context) => relay(request, context, "GET");
export const POST = (request: NextRequest, context: Context) => relay(request, context, "POST");
export const DELETE = (request: NextRequest, context: Context) => relay(request, context, "DELETE");
