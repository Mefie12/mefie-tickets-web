import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET() {
  const result = await backendRequest("/api/organization/members", { method: "GET" });
  return relayResponse(result);
}
