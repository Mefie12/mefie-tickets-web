import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ membershipId: string }> }) {
  const { membershipId } = await params;
  const body = await request.json();
  const result = await backendRequest(`/api/admin/admin-users/${encodeURIComponent(membershipId)}`, {
    method: "PATCH",
    body,
  });
  return relayResponse(result);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ membershipId: string }> }) {
  const { membershipId } = await params;
  const result = await backendRequest(`/api/admin/admin-users/${encodeURIComponent(membershipId)}`, {
    method: "DELETE",
  });
  return relayResponse(result);
}
