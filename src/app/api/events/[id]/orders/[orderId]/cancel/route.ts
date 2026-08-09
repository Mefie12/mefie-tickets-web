import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> },
) {
  const { id, orderId } = await params;
  const body = await request.json();
  const result = await backendRequest(
    `/api/events/${encodeURIComponent(id)}/orders/${encodeURIComponent(orderId)}/cancel`,
    { method: "PATCH", body },
  );
  return relayResponse(result);
}
