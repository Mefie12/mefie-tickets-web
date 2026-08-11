import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await backendRequest(`/api/admin/admin-users/invitations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return relayResponse(result);
}
