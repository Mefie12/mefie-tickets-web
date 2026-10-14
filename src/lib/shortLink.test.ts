import { describe, expect, it } from "vitest";
import { canonicalEventUrl, fallbackPath, isPlausibleShortCode, normalizeAlias, validateAlias } from "./shortLink";

describe("canonicalEventUrl", () => {
  const app = "https://mefie-tickets.com";

  it("builds the canonical event path from slugs", () => {
    expect(canonicalEventUrl(app, "acme", "summer-fest")).toBe("https://mefie-tickets.com/acme/summer-fest");
  });

  it("encodes slugs instead of trusting them", () => {
    expect(canonicalEventUrl(app, "a b", "x?y#z")).toBe("https://mefie-tickets.com/a%20b/x%3Fy%23z");
  });

  it("can never leave the app origin, whatever the slug contains", () => {
    for (const evil of ["//evil.com", "/\\evil.com", "https://evil.com", "@evil.com", "..%2F..%2Fevil.com", "evil.com/../.."]) {
      const url = canonicalEventUrl(app, evil, "e");
      expect(url === null || new URL(url).origin === app).toBe(true);
      const url2 = canonicalEventUrl(app, "acme", evil);
      expect(url2 === null || new URL(url2).origin === app).toBe(true);
    }
  });

  it("rejects missing or non-string slugs", () => {
    expect(canonicalEventUrl(app, undefined, "e")).toBeNull();
    expect(canonicalEventUrl(app, "acme", "")).toBeNull();
    expect(canonicalEventUrl(app, { a: 1 }, "e")).toBeNull();
  });
});

describe("validateAlias", () => {
  it("accepts well-formed aliases and the empty clear value", () => {
    expect(validateAlias("summer-fest")).toBeNull();
    expect(validateAlias("  Summer-Fest ")).toBeNull();
    expect(validateAlias("")).toBeNull();
    expect(validateAlias("abc")).toBeNull();
  });

  it("rejects too short, bad characters and edge hyphens", () => {
    for (const bad of ["ab", "-abc", "abc-", "has space", "under_score", "a".repeat(31), "emoji🎉", "double--hyphen"]) {
      expect(validateAlias(bad)).not.toBeNull();
    }
  });

  it("normalizes case and whitespace", () => {
    expect(normalizeAlias("  AbC ")).toBe("abc");
  });
});

describe("fallbackPath", () => {
  it("sends definite misses to /discover", () => {
    expect(fallbackPath(404, "nope")).toBe("/discover");
    expect(fallbackPath(429, "nope")).toBe("/discover");
    // 2xx with an unusable destination is a bad payload, not an outage.
    expect(fallbackPath(200, "abc")).toBe("/discover");
  });

  it("sends outages (timeout/network = null, 5xx) to the try-again page with the code", () => {
    expect(fallbackPath(null, "Summer-Fest")).toBe("/link-unavailable?code=summer-fest");
    expect(fallbackPath(503, "tcr88f")).toBe("/link-unavailable?code=tcr88f");
    expect(fallbackPath(500, "tcr88f")).toBe("/link-unavailable?code=tcr88f");
  });

  it("never echoes a code that isn't a plausible short code", () => {
    expect(fallbackPath(null, "https://evil.com")).toBe("/link-unavailable");
    expect(fallbackPath(null, "a/b")).toBe("/link-unavailable");
    expect(fallbackPath(null, "x".repeat(60))).toBe("/link-unavailable");
  });
});

describe("isPlausibleShortCode", () => {
  it("accepts auto codes and aliases only", () => {
    for (const ok of ["tcr88f", "summer-fest", "abc"]) expect(isPlausibleShortCode(ok)).toBe(true);
    for (const bad of ["ab", "a--b", "-abc", "has space", "A", 5, undefined]) expect(isPlausibleShortCode(bad)).toBe(false);
  });
});
