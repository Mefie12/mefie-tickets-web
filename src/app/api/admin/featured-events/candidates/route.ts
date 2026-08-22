import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";
export async function GET(request: NextRequest) { return relayResponse(await backendRequest(`/api/admin/featured-events/candidates${request.nextUrl.search}`)); }
