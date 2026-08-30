import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(request: NextRequest, { params }: { params: Promise<{ gatePassId: string }> }) {
  const { gatePassId } = await params;
  return relayResponse(
    await backendRequest(`/api/gate-passes/${encodeURIComponent(gatePassId)}/rotate-secret`, { method: "POST" }),
  );
}
