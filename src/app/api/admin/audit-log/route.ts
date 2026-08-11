import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(request: NextRequest) {
  const result = await backendRequest(`/api/admin/audit-log${request.nextUrl.search}`, { method: "GET" });
  return relayResponse(result);
}
