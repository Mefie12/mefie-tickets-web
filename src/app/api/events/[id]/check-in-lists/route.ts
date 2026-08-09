import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await backendRequest(`/api/events/${encodeURIComponent(id)}/check-in-lists`, { method: "GET" });
  return relayResponse(result);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const result = await backendRequest(`/api/events/${encodeURIComponent(id)}/check-in-lists`, {
    method: "POST",
    body,
  });
  return relayResponse(result);
}
