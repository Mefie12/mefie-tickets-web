import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";
export async function POST() { return relayResponse(await backendRequest("/api/admin/sessions/end-others", { method: "POST" })); }
