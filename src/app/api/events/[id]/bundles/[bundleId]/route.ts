import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; bundleId: string }> }) {
  const { id, bundleId } = await params;
  const body = await request.json();
  const result = await backendRequest(
    `/api/events/${encodeURIComponent(id)}/bundles/${encodeURIComponent(bundleId)}`,
    { method: "PATCH", body },
  );
  return relayResponse(result);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; bundleId: string }> }) {
  const { id, bundleId } = await params;
  const result = await backendRequest(
    `/api/events/${encodeURIComponent(id)}/bundles/${encodeURIComponent(bundleId)}`,
    { method: "DELETE" },
  );
  return relayResponse(result);
}
