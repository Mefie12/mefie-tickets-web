import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string; setupId: string }> }) {
  const { id, setupId } = await params;
  return relayResponse(
    await backendRequest(
      `/api/events/${encodeURIComponent(id)}/scanner-setups/${encodeURIComponent(setupId)}/resend-code`,
      { method: "POST" },
    ),
  );
}
