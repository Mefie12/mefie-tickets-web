import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET() {
  const result = await backendRequest("/api/admin/session", { method: "GET" });
  return relayResponse(result);
}
