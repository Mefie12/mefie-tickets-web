import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";
export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) { const { token } = await params; return relayResponse(await backendRequest(`/api/auth/complimentary-invitation/${encodeURIComponent(token)}`)); }
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) { const { token } = await params; const body = await request.json().catch(() => undefined); return relayResponse(await backendRequest(`/api/auth/complimentary-invitation/${encodeURIComponent(token)}`, { method: "POST", body })); }
