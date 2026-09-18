import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const result = await backendRequest("/api/admin/platform-settings/reservation-hold-minutes", { method: "PUT", body });
  return relayResponse(result);
}

export async function DELETE() {
  const result = await backendRequest("/api/admin/platform-settings/reservation-hold-minutes", { method: "DELETE" });
  return relayResponse(result);
}
