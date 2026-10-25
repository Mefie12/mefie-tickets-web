import { ApiError } from "@/lib/authApi";
import { friendlyStatusMessage } from "@/lib/structuredError";

type ErrorBody = { message?: unknown; errors?: Record<string, string[]>; code?: unknown; request_id?: unknown };

/**
 * Pure: builds an ApiError from a failed fetch Response and its (possibly missing / non-JSON) parsed body,
 * or from a thrown fetch TypeError (pass `res` null). Never yields an empty message.
 */
export function errorFromResponse(res: Pick<Response, "status" | "headers"> | null, data: unknown): ApiError {
  if (!res) {
    const error = new ApiError("You appear to be offline. Check your connection and try again.", 0, undefined, "NETWORK_ERROR");
    return error;
  }

  const body: ErrorBody | null = typeof data === "object" && data !== null && !Array.isArray(data) ? (data as ErrorBody) : null;
  const message = typeof body?.message === "string" && body.message !== "" ? body.message : friendlyStatusMessage(res.status);
  const code = typeof body?.code === "string" ? body.code : body?.message ? undefined : res.status >= 500 ? "SERVER_ERROR" : "REQUEST_FAILED";

  const error = new ApiError(message, res.status, body?.errors, code);
  const requestId = typeof body?.request_id === "string" ? body.request_id : res.headers?.get("x-request-id");
  if (requestId) error.requestId = requestId;
  return error;
}

/** Wraps a thrown fetch failure (TypeError "Failed to fetch" etc.) as a NETWORK_ERROR ApiError. */
export function errorFromFetchFailure(error: unknown): ApiError {
  void error;
  return errorFromResponse(null, null);
}
