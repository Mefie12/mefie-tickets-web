import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";
export async function DELETE(_: Request, { params }: { params: Promise<{ session: string }> }) { const { session } = await params; return relayResponse(await backendRequest(`/api/admin/sessions/${encodeURIComponent(session)}`, { method: "DELETE" })); }
