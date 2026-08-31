import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string; refundRequestId: string }> },
) {
  const { id, orderId, refundRequestId } = await params;
  const body = await request.json();
  return relayResponse(
    await backendRequest(
      `/api/events/${encodeURIComponent(id)}/orders/${encodeURIComponent(orderId)}/refund-requests/${encodeURIComponent(refundRequestId)}/decision`,
      { method: "POST", body },
    ),
  );
}
