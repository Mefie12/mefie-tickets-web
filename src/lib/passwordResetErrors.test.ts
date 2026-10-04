import { describe, expect, it } from "vitest";
import { ApiError } from "./authApi";
import { resetRequestErrorMessage } from "./passwordResetErrors";

describe("resetRequestErrorMessage", () => {
  it("tells the user how long to wait when rate limited", () => {
    const error = new ApiError("Too Many Attempts.", 429);
    error.retryAfter = 42;
    expect(resetRequestErrorMessage(error)).toBe("Too many attempts. Try again in 42 seconds.");
  });

  it("still explains a 429 without a Retry-After", () => {
    expect(resetRequestErrorMessage(new ApiError("Too Many Attempts.", 429))).toMatch(/wait a minute/);
  });

  it("gives a connection hint for network and other failures", () => {
    expect(resetRequestErrorMessage(new TypeError("Failed to fetch"))).toMatch(/Check your connection/);
    expect(resetRequestErrorMessage(new ApiError("Server error", 500))).toMatch(/Check your connection/);
  });

  it("never mentions accounts or emails existing", () => {
    for (const error of [new ApiError("x", 429), new ApiError("x", 500), new Error("x")]) {
      expect(resetRequestErrorMessage(error)).not.toMatch(/no account|not found|doesn't exist/i);
    }
  });
});
