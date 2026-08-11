import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await backendRequest(`/api/auth/admin-invitation/${encodeURIComponent(token)}`, { method: "GET" });
  return relayResponse(result);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await request.json().catch(() => undefined);
  const result = await backendRequest(`/api/auth/admin-invitation/${encodeURIComponent(token)}`, {
    method: "POST",
    body,
  });
  return relayResponse(result);
}
