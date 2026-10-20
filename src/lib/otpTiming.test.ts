import { describe, expect, it } from "vitest";
import { deadlineIn, formatMMSS, parseOtpTiming, resendLabel, secondsUntil, withRetryHint } from "./otpTiming";

describe("otpTiming", () => {
  it("rounds seconds up and never goes negative", () => {
    const now = 1_000_000;
    expect(secondsUntil(now + 1_200, now)).toBe(2);
    expect(secondsUntil(now + 1_000, now)).toBe(1);
    expect(secondsUntil(now - 5_000, now)).toBe(0);
    expect(secondsUntil(null, now)).toBe(0);
  });

  it("formats m:ss", () => {
    expect(formatMMSS(0)).toBe("0:00");
    expect(formatMMSS(7)).toBe("0:07");
    expect(formatMMSS(60)).toBe("1:00");
    expect(formatMMSS(899)).toBe("14:59");
    expect(formatMMSS(-3)).toBe("0:00");
  });

  it("turns server seconds into client deadlines", () => {
    const now = 5_000;
    expect(parseOtpTiming({ expires_in: 900, resend_in: 60 }, now)).toEqual({
      expiresAt: deadlineIn(900, now),
      resendAt: deadlineIn(60, now),
    });
  });

  it("ignores missing or invalid timing", () => {
    expect(parseOtpTiming({ expires_in: "x", resend_in: 0 })).toEqual({ expiresAt: null, resendAt: null });
    expect(parseOtpTiming(undefined)).toEqual({ expiresAt: null, resendAt: null });
  });

  it("labels the resend button", () => {
    expect(resendLabel(47)).toBe("Resend in 0:47");
    expect(resendLabel(0)).toBe("Resend code");
    expect(resendLabel(0, "Send a new code")).toBe("Send a new code");
  });

  it("adds a retry hint only when there is a wait", () => {
    expect(withRetryHint("Too many requests.", 75)).toBe("Too many requests. Try again in 1:15.");
    expect(withRetryHint("Too many requests.", undefined)).toBe("Too many requests.");
    expect(withRetryHint("Too many requests.", 0)).toBe("Too many requests.");
  });
});
