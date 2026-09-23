import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await params;
  if (kind !== "orders" && kind !== "attendees") return new Response("Not found", { status: 404 });
  return relayResponse(await backendRequest(`/api/events/${encodeURIComponent(id)}/responses/${kind}?${request.nextUrl.searchParams}`));
}
