import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";
export async function DELETE(_: Request, { params }: { params: Promise<{ placementId: string }> }) { const { placementId } = await params; return relayResponse(await backendRequest(`/api/admin/featured-events/${encodeURIComponent(placementId)}`, { method: "DELETE" })); }
