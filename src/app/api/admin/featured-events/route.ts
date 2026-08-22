import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";
export async function GET() { return relayResponse(await backendRequest("/api/admin/featured-events")); }
export async function POST(request: NextRequest) { return relayResponse(await backendRequest("/api/admin/featured-events", { method: "POST", body: await request.json() })); }
