import { describe, expect, it } from "vitest";
import { errorFromFetchFailure, errorFromResponse } from "@/lib/apiResponseError";

const res = (status: number, headers: Record<string, string> = {}) => ({ status, headers: new Headers(headers) });

describe("errorFromResponse", () => {
  it("gives a friendly 5xx message for a null body", () => {
    const e = errorFromResponse(res(500), null);
    expect(e.message).toBe("We couldn't complete that. Please try again.");
    expect(e.status).toBe(500);
    expect(e.code).toBe("SERVER_ERROR");
  });

  it("treats an HTML (non-object) body like an empty one", () => {
    const e = errorFromResponse(res(502), "<html>Bad gateway</html>");
    expect(e.message).toBe("We couldn't complete that. Please try again.");
  });

  it("handles an empty object body", () => {
    expect(errorFromResponse(res(404), {}).message).toMatch(/couldn't find/);
  });

  it("keeps the server message, code and errors", () => {
    const e = errorFromResponse(res(422), { message: "Bad", code: "X", errors: { email: ["no"] } });
    expect(e.message).toBe("Bad");
    expect(e.code).toBe("X");
    expect(e.fieldError("email")).toBe("no");
  });

  it("reads the request id from the body, then the header", () => {
    expect(errorFromResponse(res(500, { "x-request-id": "hdr" }), { request_id: "body" }).requestId).toBe("body");
    expect(errorFromResponse(res(500, { "x-request-id": "hdr" }), null).requestId).toBe("hdr");
    expect(errorFromResponse(res(500), null).requestId).toBeUndefined();
  });

  it("maps a fetch failure to NETWORK_ERROR", () => {
    const e = errorFromFetchFailure(new TypeError("Failed to fetch"));
    expect(e.code).toBe("NETWORK_ERROR");
    expect(e.message).toBe("You appear to be offline. Check your connection and try again.");
  });
});
