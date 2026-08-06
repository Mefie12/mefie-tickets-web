import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await backendRequest("/api/auth/login", { method: "POST", body });
  return relayResponse(result);
}
