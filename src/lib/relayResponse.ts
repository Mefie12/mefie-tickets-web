import { NextResponse } from "next/server";
import type { BackendResult } from "@/lib/backend";
import { buildStructuredErrorBody } from "@/lib/structuredError";

/**
 * Turns a backendRequest() result into a NextResponse, relaying every
 * Set-Cookie header Laravel sent back onto the response the browser
 * actually receives — this is what keeps the browser's cookie jar in
 * sync with Laravel's session without ever exposing the cookie to
 * client-side JS.
 */
/** Fetch-spec "null body" statuses — constructing a Response with any body at these throws. */
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

export function relayResponse<T>(result: BackendResult<T>, options: { structuredErrors?: boolean } = {}): NextResponse {
  // Opt-in: replace an empty / non-object / message-less error body with {code, message, request_id}.
  const structured = options.structuredErrors && !result.ok ? buildStructuredErrorBody(result.status, result.data, result.requestId) : null;
  const response = structured
    ? NextResponse.json(structured, { status: result.status })
    : NULL_BODY_STATUSES.has(result.status)
      ? new NextResponse(null, { status: result.status })
      : NextResponse.json(result.data, { status: result.status });
  if (options.structuredErrors && result.requestId) response.headers.set("X-Request-Id", result.requestId);
  if (result.retryAfter) response.headers.set("Retry-After", result.retryAfter);
  for (const cookie of result.setCookieHeaders) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
}
