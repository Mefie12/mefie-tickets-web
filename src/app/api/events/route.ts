import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(request: NextRequest) {
  const organizerId = request.nextUrl.searchParams.get("organizer_id");
  const query = organizerId ? `?organizer_id=${encodeURIComponent(organizerId)}` : "";
  const result = await backendRequest(`/api/events${query}`, { method: "GET" });
  return relayResponse(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await backendRequest("/api/events", { method: "POST", body });
  return relayResponse(result);
}
