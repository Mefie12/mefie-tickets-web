import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return relayResponse(await backendRequest(`/api/events/${encodeURIComponent(id)}/overview`));
}
