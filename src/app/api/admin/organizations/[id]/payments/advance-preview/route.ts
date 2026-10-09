import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const qs = new URLSearchParams();
  for (const key of ["event_id", "amount_minor"]) {
    const value = request.nextUrl.searchParams.get(key);
    if (value !== null) qs.set(key, value);
  }
  const result = await backendRequest(`/api/admin/organizations/${encodeURIComponent(id)}/payments/advance-preview?${qs.toString()}`);
  return relayResponse(result);
}
