import { describe, expect, it } from "vitest";
import { buildShortLinkDestination, canonicalEventUrl, fallbackPath, isPlausibleShortCode, normalizeAlias, shareIntentUrl, taggedShortUrl, validateAlias } from "./shortLink";

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

describe("buildShortLinkDestination", () => {
  const canonical = "https://mefie-tickets.com/acme/summer-fest";
  const api = { utm_source: "whatsapp", utm_medium: "social", utm_campaign: "summer-fest" };
  const build = (query: string, utm: unknown = api) => new URL(buildShortLinkDestination(canonical, new URLSearchParams(query), utm));

  it("adds the channel UTMs when the sharer added nothing", () => {
    const url = build("c=wa");
    expect(url.origin + url.pathname).toBe(canonical);
    expect(Object.fromEntries(url.searchParams)).toEqual(api);
  });

  it("keeps the sharer's own utm values and only fills the gaps", () => {
    const url = build("utm_source=newsletter&utm_term=spring");
    expect(url.searchParams.get("utm_source")).toBe("newsletter");
    expect(url.searchParams.get("utm_medium")).toBe("social");
    expect(url.searchParams.get("utm_campaign")).toBe("summer-fest");
    expect(url.searchParams.get("utm_term")).toBe("spring");
  });

  it("passes ad click ids through but drops everything else, including the c tag", () => {
    const url = build("c=fb&fbclid=abc123&gclid=g1&ttclid=t1&msclkid=m1&evil=1&redirect=https://evil.com&next=/x");
    expect(Object.fromEntries(url.searchParams)).toEqual({ ...api, fbclid: "abc123", gclid: "g1", ttclid: "t1", msclkid: "m1" });
  });

  it("cleans untrusted values: control characters stripped, length capped, empty ignored", () => {
    const long = "x".repeat(500);
    const url = build(`utm_source=a%0D%0Ab%00c&utm_medium=${long}&utm_campaign=%20%20`);
    expect(url.searchParams.get("utm_source")).toBe("abc");
    expect(url.searchParams.get("utm_medium")).toHaveLength(200);
    expect(url.searchParams.get("utm_campaign")).toBe("summer-fest");
  });

  it("takes the first value when a param is repeated and never changes origin or path", () => {
    const url = build("utm_source=first&utm_source=second&utm_campaign=//evil.com");
    expect(url.searchParams.get("utm_source")).toBe("first");
    expect(url.origin).toBe("https://mefie-tickets.com");
    expect(url.pathname).toBe("/acme/summer-fest");
  });

  it("tolerates a missing or malformed API utm object", () => {
    for (const bad of [null, "x", 5, [], { utm_source: 5 }]) {
      expect(() => build("", bad)).not.toThrow();
    }
    expect(build("", null).search).toBe("");
  });
});

describe("share channels", () => {
  const tagged = taggedShortUrl("https://mefie-tickets.com/s/abc123", "wa");

  it("tags the short url with the channel", () => {
    expect(tagged).toBe("https://mefie-tickets.com/s/abc123?c=wa");
    expect(taggedShortUrl("https://x.test/s/a?z=1", "fb")).toBe("https://x.test/s/a?z=1&c=fb");
  });

  it("builds an encoded web share link per channel", () => {
    const title = "Summer Fest & Friends";
    expect(shareIntentUrl("wa", tagged, title)).toBe(`https://wa.me/?text=${encodeURIComponent(`${title} ${tagged}`)}`);
    expect(shareIntentUrl("fb", tagged, title)).toBe(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(tagged)}`);
    expect(shareIntentUrl("x", tagged, title)).toBe(`https://twitter.com/intent/tweet?url=${encodeURIComponent(tagged)}&text=${encodeURIComponent(title)}`);
    expect(shareIntentUrl("tg", tagged, title)).toContain("https://t.me/share/url?url=");
    expect(shareIntentUrl("li", tagged, title)).toContain("https://www.linkedin.com/sharing/share-offsite/?url=");
    expect(shareIntentUrl("em", tagged, title, "Get tickets")).toBe(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`Get tickets\n\n${tagged}`)}`);
  });

  it("has no web share link for copy-only channels", () => {
    expect(shareIntentUrl("ig", tagged, "t")).toBeNull();
    expect(shareIntentUrl("tt", tagged, "t")).toBeNull();
  });
});
