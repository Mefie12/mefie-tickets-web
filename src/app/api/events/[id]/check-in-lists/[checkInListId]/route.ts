import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; checkInListId: string }> },
) {
  const { id, checkInListId } = await params;
  const result = await backendRequest(
    `/api/events/${encodeURIComponent(id)}/check-in-lists/${encodeURIComponent(checkInListId)}`,
    { method: "GET" },
  );
  return relayResponse(result);
}
