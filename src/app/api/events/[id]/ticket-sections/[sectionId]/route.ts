import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

type Ctx = { params: Promise<{ id: string; sectionId: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id, sectionId } = await params;
  const body = await request.json();
  const result = await backendRequest(
    `/api/events/${encodeURIComponent(id)}/ticket-sections/${encodeURIComponent(sectionId)}`,
    { method: "PATCH", body },
  );
  return relayResponse(result);
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id, sectionId } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await backendRequest(
    `/api/events/${encodeURIComponent(id)}/ticket-sections/${encodeURIComponent(sectionId)}`,
    { method: "DELETE", body },
  );
  return relayResponse(result);
}
