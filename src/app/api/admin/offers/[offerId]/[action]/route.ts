import { NextRequest, NextResponse } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

const ACTIONS = new Set(["pause", "end"]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ offerId: string; action: string }> }) {
  const { offerId, action } = await params;
  if (!ACTIONS.has(action)) return NextResponse.json({ message: "Not found." }, { status: 404 });
  return relayResponse(
    await backendRequest(`/api/admin/offers/${encodeURIComponent(offerId)}/${action}`, { method: "POST", body: await request.json() }),
  );
}
