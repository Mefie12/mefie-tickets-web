import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  return relayResponse(await backendRequest(`/api/event-series/${encodeURIComponent(id)}/recurrence-changes`, { method: "POST", body }));
}
