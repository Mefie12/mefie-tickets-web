import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(request: NextRequest) {
  const country = request.nextUrl.searchParams.get("country") ?? "";
  return relayResponse(
    await backendRequest(`/api/organization/payments/supported-currencies?country=${encodeURIComponent(country)}`, { method: "GET" }),
  );
}
