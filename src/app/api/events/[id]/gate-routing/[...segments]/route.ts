import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

async function relay(request: NextRequest, params: Promise<{ id: string; segments: string[] }>, method: "GET" | "POST") {
  const { id, segments } = await params;
  const suffix = segments.length ? `/${segments.map(encodeURIComponent).join("/")}` : "";
  const body = method === "GET" ? undefined : await request.json();
  return relayResponse(await backendRequest(`/api/events/${encodeURIComponent(id)}/gate-routing${suffix}`, { method, body }));
}

export const GET = (request: NextRequest, { params }: { params: Promise<{ id: string; segments: string[] }> }) => relay(request, params, "GET");
export const POST = (request: NextRequest, { params }: { params: Promise<{ id: string; segments: string[] }> }) => relay(request, params, "POST");
