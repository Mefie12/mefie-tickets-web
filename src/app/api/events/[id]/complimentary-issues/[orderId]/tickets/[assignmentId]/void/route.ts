import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string; assignmentId: string }> },
) {
  const { id, orderId, assignmentId } = await params;
  return relayResponse(
    await backendRequest(
      `/api/events/${encodeURIComponent(id)}/complimentary-issues/${encodeURIComponent(orderId)}/tickets/${encodeURIComponent(assignmentId)}/void`,
      { method: "POST", body: await request.json().catch(() => ({})) },
    ),
  );
}
