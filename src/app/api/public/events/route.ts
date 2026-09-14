import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

/**
 * A same-origin passthrough for the public (unauthenticated) events
 * listing — needed so client-side code (the Discover "Load More"
 * button) can fetch additional pages directly. backendRequest() reads
 * `next/headers` cookies and can only run server-side, so the browser
 * calls this Route Handler instead of the Laravel API.
 */
export async function GET(request: NextRequest) {
  return relayResponse(await backendRequest(`/api/public/events?${request.nextUrl.searchParams}`));
}
