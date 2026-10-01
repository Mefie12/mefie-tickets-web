import { describe, expect, it } from "vitest";
import { clientIpFromHeaders } from "@/lib/clientIp";

const h = (values: Record<string, string>) => ({ get: (name: string) => values[name.toLowerCase()] ?? null });

describe("clientIpFromHeaders", () => {
  it("takes the address the nearest proxy saw (rightmost) by default", () => {
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
  });
  it("never trusts a browser-supplied leftmost value", () => {
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" }))).toBe("203.0.113.7");
  });
  it("counts trusted hops from the right", () => {
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.7, 10.0.0.1" }), 2)).toBe("203.0.113.7");
  });
  it("supports IPv6", () => expect(clientIpFromHeaders(h({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1"));
  it("falls back to x-real-ip when the list is shorter than the hops", () => {
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "10.0.0.1", "x-real-ip": "203.0.113.9" }), 2)).toBe("203.0.113.9");
  });
  it("rejects invalid or missing values", () => {
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "not-an-ip" }))).toBeNull();
    expect(clientIpFromHeaders(h({}))).toBeNull();
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "203.0.113.7" }), Number.NaN)).toBe("203.0.113.7");
  });
});
