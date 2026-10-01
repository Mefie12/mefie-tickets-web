import { NextRequest, NextResponse } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

const ACTIONS = new Set(["activate", "pause", "resume", "end"]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; offerId: string; action: string }> }) {
  const { id, offerId, action } = await params;
  if (!ACTIONS.has(action)) return NextResponse.json({ message: "Not found." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  return relayResponse(
    await backendRequest(`/api/events/${encodeURIComponent(id)}/offers/${encodeURIComponent(offerId)}/${action}`, { method: "POST", body }),
  );
}
