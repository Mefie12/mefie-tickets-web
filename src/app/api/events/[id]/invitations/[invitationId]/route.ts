import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; invitationId: string }> }) {
  const { id, invitationId } = await params;
  return relayResponse(await backendRequest(`/api/events/${encodeURIComponent(id)}/invitations/${encodeURIComponent(invitationId)}`, { method: "DELETE" }));
}
