import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST() {
  const result = await backendRequest("/api/auth/logout", { method: "POST" });
  return relayResponse(result);
}
