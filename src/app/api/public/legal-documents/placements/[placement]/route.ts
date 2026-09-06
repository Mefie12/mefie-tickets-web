import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(request: NextRequest, { params }: { params: Promise<{ placement: string }> }) {
  const { placement } = await params;
  const result = await backendRequest(`/api/public/legal-documents/placements/${encodeURIComponent(placement)}`);
  return relayResponse(result);
}
