import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(_: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  return relayResponse(await backendRequest(`/api/admin/offers/${encodeURIComponent(offerId)}`));
}
