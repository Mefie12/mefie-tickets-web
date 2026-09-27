import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; gateId: string }> }) {
  const { id, gateId } = await params;
  return relayResponse(await backendRequest(
    `/api/events/${encodeURIComponent(id)}/gates/${encodeURIComponent(gateId)}`,
    { method: "PATCH", body: await request.json() },
  ));
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; gateId: string }> }) {
  const { id, gateId } = await params;
  return relayResponse(await backendRequest(
    `/api/events/${encodeURIComponent(id)}/gates/${encodeURIComponent(gateId)}`,
    { method: "DELETE" },
  ));
}
