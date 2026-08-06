import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await request.json();
  const result = await backendRequest(`/api/auth/invitation/${encodeURIComponent(token)}`, {
    method: "POST",
    body,
  });
  return relayResponse(result);
}
