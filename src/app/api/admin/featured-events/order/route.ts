import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";
export async function PUT(request: NextRequest) { return relayResponse(await backendRequest("/api/admin/featured-events/order", { method: "PUT", body: await request.json() })); }
