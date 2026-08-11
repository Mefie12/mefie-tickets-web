import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET() {
  const result = await backendRequest("/api/admin/admin-users", { method: "GET" });
  return relayResponse(result);
}
