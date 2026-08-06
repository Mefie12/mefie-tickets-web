import { NextResponse } from "next/server";
import type { BackendResult } from "@/lib/backend";

/**
 * Turns a backendRequest() result into a NextResponse, relaying every
 * Set-Cookie header Laravel sent back onto the response the browser
 * actually receives — this is what keeps the browser's cookie jar in
 * sync with Laravel's session without ever exposing the cookie to
 * client-side JS.
 */
export function relayResponse<T>(result: BackendResult<T>): NextResponse {
  const response = NextResponse.json(result.data, { status: result.status });
  for (const cookie of result.setCookieHeaders) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
}
