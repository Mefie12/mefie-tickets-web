import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST() {
  return relayResponse(await backendRequest("/api/organization/payments/management-session", { method: "POST" }));
}
