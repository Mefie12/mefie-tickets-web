import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; ticketId: string }> }) {
  const { id, ticketId } = await params;
  return relayResponse(await backendRequest(
    `/api/events/${encodeURIComponent(id)}/tickets/${encodeURIComponent(ticketId)}/resend`,
    { method: "POST", body: await request.json() },
  ));
}
