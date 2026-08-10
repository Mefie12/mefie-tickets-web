import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const { id, versionId } = await params;
  const result = await backendRequest(
    `/api/events/${encodeURIComponent(id)}/terms/versions/${encodeURIComponent(versionId)}`,
  );
  return relayResponse(result);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const { id, versionId } = await params;
  const body = await request.json();
  const result = await backendRequest(
    `/api/events/${encodeURIComponent(id)}/terms/versions/${encodeURIComponent(versionId)}`,
    { method: "PATCH", body },
  );
  return relayResponse(result);
}
