import { describe, expect, it } from "vitest";
import { emailFieldError } from "./emailFieldError";

describe("emailFieldError", () => {
  it("says nothing before it is time, for an empty field, or for a valid address", () => {
    expect(emailFieldError({ value: "a@b", ok: false, shown: false })).toBeUndefined();
    expect(emailFieldError({ value: "", ok: false, shown: true })).toBeUndefined();
    expect(emailFieldError({ value: "   ", ok: false, shown: true })).toBeUndefined();
    expect(emailFieldError({ value: "ama@example.com", ok: true, shown: true })).toBeUndefined();
  });

  it("flags a typed, invalid address once it is time, with the default or a custom message", () => {
    expect(emailFieldError({ value: "a@b", ok: false, shown: true })).toBe("Enter a valid email address");
    expect(emailFieldError({ value: "a@b", ok: false, shown: true, message: "Fix these" })).toBe("Fix these");
  });
});
