import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET() {
  return relayResponse(await backendRequest("/api/organization/payments", { method: "GET" }));
}
