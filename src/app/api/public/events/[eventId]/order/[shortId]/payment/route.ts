import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string; shortId: string }> },
) {
  const { eventId, shortId } = await params;
  return relayResponse(await backendRequest(
    `/api/public/events/${encodeURIComponent(eventId)}/order/${encodeURIComponent(shortId)}/payment`,
    { method: "POST" },
  ));
}
