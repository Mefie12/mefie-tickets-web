import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await backendRequest(`/api/event-series/${encodeURIComponent(id)}/apply-ticket-layout`, { method: "POST" });
  return relayResponse(result);
}
