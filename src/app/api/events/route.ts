import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET() {
  const result = await backendRequest("/api/events", { method: "GET" });
  return relayResponse(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await backendRequest("/api/events", { method: "POST", body });
  return relayResponse(result);
}
