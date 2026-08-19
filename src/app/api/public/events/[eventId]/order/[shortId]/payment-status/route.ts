import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(_request: NextRequest, context: { params: Promise<{ eventId: string; shortId: string }> }) {
  const { eventId, shortId } = await context.params;
  return relayResponse(await backendRequest(
    `/api/public/events/${encodeURIComponent(eventId)}/order/${encodeURIComponent(shortId)}/payment-status`,
  ));
}
