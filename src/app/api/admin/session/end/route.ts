import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST() {
  const result = await backendRequest("/api/admin/session/end", { method: "POST" });
  return relayResponse(result);
}
