import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(request: NextRequest, { params }: { params: Promise<{ shortId: string }> }) {
  const { shortId } = await params;
  const result = await backendRequest(`/api/public/check-in-lists/${encodeURIComponent(shortId)}`, {
    method: "GET",
  });
  return relayResponse(result);
}
