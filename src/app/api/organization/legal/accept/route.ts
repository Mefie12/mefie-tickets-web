import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(request: NextRequest) {
  return relayResponse(await backendRequest("/api/organization/legal/accept", { method: "POST", body: await request.json() }));
}
