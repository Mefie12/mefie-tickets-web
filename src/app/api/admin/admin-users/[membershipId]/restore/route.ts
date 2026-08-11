import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function PATCH(_request: Request, { params }: { params: Promise<{ membershipId: string }> }) {
  const { membershipId } = await params;
  const result = await backendRequest(`/api/admin/admin-users/${encodeURIComponent(membershipId)}/restore`, {
    method: "PATCH",
  });
  return relayResponse(result);
}
