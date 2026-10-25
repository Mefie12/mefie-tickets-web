import { describe, expect, it } from "vitest";
import { buildStructuredErrorBody } from "@/lib/structuredError";

describe("buildStructuredErrorBody", () => {
  it("builds a body for a null upstream body", () => {
    expect(buildStructuredErrorBody(500, null, "rid")).toEqual({
      code: "SERVER_ERROR",
      message: "We couldn't complete that. Please try again.",
      request_id: "rid",
    });
  });

  it("uses upstream codes for synthetic 503/504", () => {
    expect(buildStructuredErrorBody(503, null)?.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(buildStructuredErrorBody(504, null)?.code).toBe("UPSTREAM_TIMEOUT");
  });

  it("keeps an existing code when only the message is missing", () => {
    expect(buildStructuredErrorBody(500, { code: "BOOM" })?.code).toBe("BOOM");
  });

  it("returns null when the body already has a message", () => {
    expect(buildStructuredErrorBody(422, { message: "Invalid", errors: {} }, "rid")).toBeNull();
  });

  it("treats arrays and strings as unusable", () => {
    expect(buildStructuredErrorBody(500, [])).not.toBeNull();
    expect(buildStructuredErrorBody(500, "oops")).not.toBeNull();
  });

  it("omits request_id when unknown", () => {
    expect(buildStructuredErrorBody(500, null)).not.toHaveProperty("request_id");
  });
});
