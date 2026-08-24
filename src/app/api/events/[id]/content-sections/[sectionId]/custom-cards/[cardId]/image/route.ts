import { NextRequest } from "next/server";
import { backendUpload } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string; cardId: string }> },
) {
  const { id, sectionId, cardId } = await params;
  const formData = await request.formData();
  const result = await backendUpload(
    `/api/events/${encodeURIComponent(id)}/content-sections/${encodeURIComponent(sectionId)}/custom-cards/${encodeURIComponent(cardId)}/image`,
    formData,
  );
  return relayResponse(result);
}
