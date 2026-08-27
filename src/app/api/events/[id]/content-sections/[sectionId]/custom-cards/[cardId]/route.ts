import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string; cardId: string }> },
) {
  const { id, sectionId, cardId } = await params;
  const body = await request.json();
  const result = await backendRequest(
    `/api/events/${encodeURIComponent(id)}/content-sections/${encodeURIComponent(sectionId)}/custom-cards/${encodeURIComponent(cardId)}`,
    { method: "PATCH", body },
  );
  return relayResponse(result);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string; cardId: string }> },
) {
  const { id, sectionId, cardId } = await params;
  const result = await backendRequest(
    `/api/events/${encodeURIComponent(id)}/content-sections/${encodeURIComponent(sectionId)}/custom-cards/${encodeURIComponent(cardId)}`,
    { method: "DELETE" },
  );
  return relayResponse(result);
}
