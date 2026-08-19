import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

type Context = { params: Promise<{ segments: string[] }> };
async function relay(request: NextRequest, context: Context, method: "GET" | "POST" | "PATCH" | "DELETE") {
  const { segments } = await context.params;
  const body = method === "GET" ? undefined : await request.json().catch(() => undefined);
  return relayResponse(await backendRequest(`/api/admin/event-taxonomy/${segments.join("/")}${request.nextUrl.search}`, { method, body }));
}
export const GET = (request: NextRequest, context: Context) => relay(request, context, "GET");
export const POST = (request: NextRequest, context: Context) => relay(request, context, "POST");
export const PATCH = (request: NextRequest, context: Context) => relay(request, context, "PATCH");
export const DELETE = (request: NextRequest, context: Context) => relay(request, context, "DELETE");
