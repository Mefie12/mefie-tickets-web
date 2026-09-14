import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; gateId: string }> }) {
  const { id, gateId } = await params;
  return relayResponse(await backendRequest(
    `/api/events/${encodeURIComponent(id)}/gates/${encodeURIComponent(gateId)}/lanes`,
    { method: "POST", body: await request.json() },
  ));
}
