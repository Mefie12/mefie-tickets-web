import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; shortId: string }> },
) {
  const { eventId, shortId } = await params;
  const result = await backendRequest(
    `/api/public/events/${encodeURIComponent(eventId)}/order/${encodeURIComponent(shortId)}/stripe/payment_intent`,
    { method: "POST" },
  );
  return relayResponse(result);
}
