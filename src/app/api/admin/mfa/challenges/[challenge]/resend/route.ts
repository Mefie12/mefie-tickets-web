import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";
export async function POST(_: Request, { params }: { params: Promise<{ challenge: string }> }) { const { challenge } = await params; return relayResponse(await backendRequest(`/api/admin/mfa/challenges/${encodeURIComponent(challenge)}/resend`, { method: "POST" })); }
