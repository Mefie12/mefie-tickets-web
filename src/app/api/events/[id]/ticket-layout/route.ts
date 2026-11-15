import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await backendRequest(`/api/events/${encodeURIComponent(id)}/ticket-layout`, { method: "GET" });
  return relayResponse(result);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const result = await backendRequest(`/api/events/${encodeURIComponent(id)}/ticket-layout`, { method: "PUT", body });
  return relayResponse(result);
}
