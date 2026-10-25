/**
 * Pure builder for the structured error body relayed by relayResponse({ structuredErrors: true }).
 * Kept free of Next imports so it can be unit-tested directly.
 */

export type StructuredErrorBody = { code: string; message: string; request_id?: string };

export function friendlyStatusMessage(status: number): string {
  if (status >= 500) return "We couldn't complete that. Please try again.";
  if (status === 429) return "Too many attempts. Please wait a moment and try again.";
  if (status === 401 || status === 403) return "You don't have access to do that. Open your link again and retry.";
  if (status === 404) return "We couldn't find that. Check the link and try again.";
  if (status === 419) return "Your session expired. Please reload the page and try again.";
  if (status === 422) return "Some of the details need fixing. Please check the form and try again.";
  return "Something went wrong. Please try again.";
}

function codeForStatus(status: number): string {
  if (status === 503) return "UPSTREAM_UNAVAILABLE";
  if (status === 504) return "UPSTREAM_TIMEOUT";
  if (status >= 500) return "SERVER_ERROR";
  return "REQUEST_FAILED";
}

/**
 * Returns the body to send for a failed result, or null when the upstream body is already a usable
 * error object (has a message) and should be passed through untouched.
 */
export function buildStructuredErrorBody(status: number, data: unknown, requestId?: string): StructuredErrorBody | null {
  const isObject = typeof data === "object" && data !== null && !Array.isArray(data);
  const record = isObject ? (data as Record<string, unknown>) : null;
  if (record && typeof record.message === "string" && record.message !== "") return null;

  const code = typeof record?.code === "string" ? record.code : codeForStatus(status);
  const body: StructuredErrorBody = { code, message: friendlyStatusMessage(status) };
  if (requestId) body.request_id = requestId;
  return body;
}
