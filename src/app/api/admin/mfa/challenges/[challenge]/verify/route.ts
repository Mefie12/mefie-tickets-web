import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";
export async function POST(request: NextRequest, { params }: { params: Promise<{ challenge: string }> }) { const { challenge } = await params; return relayResponse(await backendRequest(`/api/admin/mfa/challenges/${encodeURIComponent(challenge)}/verify`, { method: "POST", body: await request.json() })); }
