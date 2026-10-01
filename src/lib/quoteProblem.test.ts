import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/authApi";
import { classifyQuoteError, quoteRetryDelay, rateLimitWaitSeconds, shouldRetryQuote } from "@/lib/quoteProblem";

const apiError = (status: number, retryAfter?: number) => {
  const e = new ApiError("x", status);
  if (retryAfter !== undefined) e.retryAfter = retryAfter;
  return e;
};

describe("classifyQuoteError", () => {
  it("is null when nothing failed", () => expect(classifyQuoteError(null)).toBeNull());
  it("calls a 429 rate limited", () => expect(classifyQuoteError(apiError(429))).toBe("RATE_LIMITED"));
  it("calls server and network failures unavailable", () => {
    expect(classifyQuoteError(apiError(500))).toBe("UNAVAILABLE");
    expect(classifyQuoteError(apiError(404))).toBe("UNAVAILABLE");
    expect(classifyQuoteError(new TypeError("Failed to fetch"))).toBe("UNAVAILABLE");
  });
});

describe("rateLimitWaitSeconds", () => {
  it("uses Retry-After, bounded to 1..60 seconds", () => {
    expect(rateLimitWaitSeconds(apiError(429, 7))).toBe(7);
    expect(rateLimitWaitSeconds(apiError(429, 3600))).toBe(60);
    expect(rateLimitWaitSeconds(apiError(429, 0.2))).toBe(1);
  });
  it("defaults to 10 seconds when the server gave none", () => {
    expect(rateLimitWaitSeconds(apiError(429))).toBe(10);
    expect(rateLimitWaitSeconds(new Error("x"))).toBe(10);
  });
});

describe("shouldRetryQuote", () => {
  it("retries network and 5xx failures twice, never 4xx (429 is handled by the hook's timer)", () => {
    expect(shouldRetryQuote(0, new TypeError("offline"))).toBe(true);
    expect(shouldRetryQuote(1, apiError(503))).toBe(true);
    expect(shouldRetryQuote(2, apiError(503))).toBe(false);
    expect(shouldRetryQuote(0, apiError(429))).toBe(false);
    expect(shouldRetryQuote(0, apiError(422))).toBe(false);
  });
  it("backs off exponentially", () => expect([0, 1].map(quoteRetryDelay)).toEqual([600, 1200]));
});
