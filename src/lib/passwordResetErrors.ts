import { ApiError } from "@/lib/authApi";

/**
 * What to tell someone whose "send me a reset link" request failed. Deliberately never account-specific: the
 * server answers identically whether or not the email exists, and so must this page.
 */
export function resetRequestErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) {
    return error.retryAfter
      ? `Too many attempts. Try again in ${error.retryAfter} seconds.`
      : "Too many attempts. Please wait a minute and try again.";
  }
  return "We couldn't send the reset link. Check your connection and try again.";
}
