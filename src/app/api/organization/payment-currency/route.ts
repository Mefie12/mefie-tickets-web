import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET() {
  return relayResponse(await backendRequest("/api/organization/payment-currency", { method: "GET" }));
}
