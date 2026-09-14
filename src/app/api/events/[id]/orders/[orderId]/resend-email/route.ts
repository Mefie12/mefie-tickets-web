import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> },
) {
  const { id, orderId } = await params;
  const body = await request.json();
  const result = await backendRequest(
    `/api/events/${encodeURIComponent(id)}/orders/${encodeURIComponent(orderId)}/resend-email`,
    { method: "POST", body },
  );
  return relayResponse(result);
}
