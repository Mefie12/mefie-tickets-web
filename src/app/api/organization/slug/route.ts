import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const result = await backendRequest("/api/organization/slug", { method: "PATCH", body });
  return relayResponse(result);
}
