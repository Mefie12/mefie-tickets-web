import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const body = await request.json();
  const result = await backendRequest(`/api/public/events/${encodeURIComponent(eventId)}/order`, {
    method: "POST",
    body,
  });
  return relayResponse(result);
}
