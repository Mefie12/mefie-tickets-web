import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(request: NextRequest) {
  const body = await request.json();
  return relayResponse(await backendRequest("/api/event-series/recurrence/preview", { method: "POST", body }));
}
