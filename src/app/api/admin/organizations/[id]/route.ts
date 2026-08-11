import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await backendRequest(`/api/admin/organizations/${encodeURIComponent(id)}`, { method: "GET" });
  return relayResponse(result);
}
