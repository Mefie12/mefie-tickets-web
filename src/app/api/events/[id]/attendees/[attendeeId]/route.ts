import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";
export async function GET(_:Request,{params}:{params:Promise<{id:string;attendeeId:string}>}){const{id,attendeeId}=await params;return relayResponse(await backendRequest(`/api/events/${encodeURIComponent(id)}/attendees/${encodeURIComponent(attendeeId)}`));}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string;attendeeId:string}>}){const{id,attendeeId}=await params;return relayResponse(await backendRequest(`/api/events/${encodeURIComponent(id)}/attendees/${encodeURIComponent(attendeeId)}/contact`,{method:"PATCH",body:await request.json()}));}
