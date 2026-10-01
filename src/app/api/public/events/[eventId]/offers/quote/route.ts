import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const body = await request.json();
  return relayResponse(
    await backendRequest(`/api/public/events/${encodeURIComponent(eventId)}/offers/quote`, { method: "POST", body }),
  );
}
