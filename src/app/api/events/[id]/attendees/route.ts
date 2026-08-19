import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){const{id}=await params;return relayResponse(await backendRequest(`/api/events/${encodeURIComponent(id)}/attendees?${request.nextUrl.searchParams}`));}
