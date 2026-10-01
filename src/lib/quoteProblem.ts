import { ApiError } from "@/lib/authApi";

/** Why a price quote could not be fetched (as opposed to the server rejecting a CODE, which is a normal answer). */
export type QuoteProblem = "RATE_LIMITED" | "UNAVAILABLE";

export function classifyQuoteError(error: unknown): QuoteProblem | null {
  if (!error) return null;
  return error instanceof ApiError && error.status === 429 ? "RATE_LIMITED" : "UNAVAILABLE";
}

const DEFAULT_RATE_LIMIT_WAIT_S = 10;
const MAX_RATE_LIMIT_WAIT_S = 60;

/** Seconds to wait after a 429 — the server's Retry-After, bounded so a bad value can't strand the buyer. */
export function rateLimitWaitSeconds(error: unknown): number {
  const asked = error instanceof ApiError ? error.retryAfter : undefined;
  return Math.min(MAX_RATE_LIMIT_WAIT_S, Math.max(1, Math.ceil(asked ?? DEFAULT_RATE_LIMIT_WAIT_S)));
}

/** React Query retry policy: transient failures retry twice; 429s are handled by the hook's timer; other 4xx never. */
export function shouldRetryQuote(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof ApiError) return error.status >= 500;
  return true; // network failure (fetch rejected)
}

export const quoteRetryDelay = (failureCount: number) => 600 * 2 ** failureCount;
