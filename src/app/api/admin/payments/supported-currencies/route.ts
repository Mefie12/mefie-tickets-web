import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(request: NextRequest) {
  const country = request.nextUrl.searchParams.get("country") ?? "";
  const result = await backendRequest(`/api/admin/payments/supported-currencies?country=${encodeURIComponent(country)}`);
  return relayResponse(result);
}
