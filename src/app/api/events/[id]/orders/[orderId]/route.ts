import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> },
) {
  const { id, orderId } = await params;
  const result = await backendRequest(
    `/api/events/${encodeURIComponent(id)}/orders/${encodeURIComponent(orderId)}`,
    { method: "GET" },
  );
  return relayResponse(result);
}
