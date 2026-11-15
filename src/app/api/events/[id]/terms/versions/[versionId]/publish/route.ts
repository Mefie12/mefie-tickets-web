import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const { id, versionId } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await backendRequest(
    `/api/events/${encodeURIComponent(id)}/terms/versions/${encodeURIComponent(versionId)}/publish`,
    { method: "PATCH", body },
  );
  return relayResponse(result);
}
