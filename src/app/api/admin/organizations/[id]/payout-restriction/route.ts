import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const result = await backendRequest(`/api/admin/organizations/${encodeURIComponent(id)}/payout-restriction`, {
    method: "PATCH",
    body,
  });
  return relayResponse(result);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const result = await backendRequest(`/api/admin/organizations/${encodeURIComponent(id)}/payout-restriction`, {
    method: "DELETE",
    body,
  });
  return relayResponse(result);
}
