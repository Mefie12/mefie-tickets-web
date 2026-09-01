import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

type Context = { params: Promise<{ id: string; segments?: string[] }> };

async function relay(request: NextRequest, context: Context, method: "GET" | "POST" | "PATCH") {
  const { id, segments = [] } = await context.params;
  const suffix = segments.length > 0 ? `/${segments.map(encodeURIComponent).join("/")}` : "";
  const body = method === "GET" ? undefined : await request.json().catch(() => undefined);
  return relayResponse(await backendRequest(`/api/events/${encodeURIComponent(id)}/gate-operations${suffix}`, { method, body }));
}

export const GET = (request: NextRequest, context: Context) => relay(request, context, "GET");
export const POST = (request: NextRequest, context: Context) => relay(request, context, "POST");
export const PATCH = (request: NextRequest, context: Context) => relay(request, context, "PATCH");
