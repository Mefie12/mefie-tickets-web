import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const result = await backendRequest(`/api/admin/users/${encodeURIComponent(id)}/restore`, {
    method: "PATCH",
    body,
  });
  return relayResponse(result);
}
