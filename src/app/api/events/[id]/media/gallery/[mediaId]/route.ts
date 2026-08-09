import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> },
) {
  const { id, mediaId } = await params;
  const body = await request.json();
  const result = await backendRequest(
    `/api/events/${encodeURIComponent(id)}/media/gallery/${encodeURIComponent(mediaId)}`,
    { method: "PATCH", body },
  );
  return relayResponse(result);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> },
) {
  const { id, mediaId } = await params;
  const result = await backendRequest(
    `/api/events/${encodeURIComponent(id)}/media/gallery/${encodeURIComponent(mediaId)}`,
    { method: "DELETE" },
  );
  return relayResponse(result);
}
