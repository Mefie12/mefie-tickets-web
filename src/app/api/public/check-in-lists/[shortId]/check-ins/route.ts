import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(request: NextRequest, { params }: { params: Promise<{ shortId: string }> }) {
  const { shortId } = await params;
  const body = await request.json();
  const result = await backendRequest(`/api/public/check-in-lists/${encodeURIComponent(shortId)}/check-ins`, {
    method: "POST",
    body,
  });
  return relayResponse(result);
}
