import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; gateId: string; laneId: string }> }) {
  const { id, gateId, laneId } = await params;
  return relayResponse(await backendRequest(
    `/api/events/${encodeURIComponent(id)}/gates/${encodeURIComponent(gateId)}/lanes/${encodeURIComponent(laneId)}`,
    { method: "PATCH", body: await request.json() },
  ));
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; gateId: string; laneId: string }> }) {
  const { id, gateId, laneId } = await params;
  return relayResponse(await backendRequest(
    `/api/events/${encodeURIComponent(id)}/gates/${encodeURIComponent(gateId)}/lanes/${encodeURIComponent(laneId)}`,
    { method: "DELETE" },
  ));
}
