import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forceEarly = request.nextUrl.searchParams.get("force_early");
  const qs = forceEarly ? `?force_early=${encodeURIComponent(forceEarly)}` : "";
  const result = await backendRequest(`/api/admin/organizations/${encodeURIComponent(id)}/payments/release-preview${qs}`);
  return relayResponse(result);
}
