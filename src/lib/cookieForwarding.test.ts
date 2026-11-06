import { afterEach, describe, expect, it, vi } from "vitest";
import { buildForwardCookieHeader } from "@/lib/cookieForwarding";

/** The implementation this replaced, verbatim — the reference for "nothing that worked before changes". */
const previous = (pairs: { name: string; value: string }[]) => pairs.map((c) => `${c.name}=${c.value}`).join("; ");

/** Does `fetch` accept this as a Cookie header at all? (the real boundary, measured on Node) */
const fetchAccepts = (header: string) => {
  try {
    new Headers({ Cookie: header });
    return true;
  } catch {
    return false;
  }
};

const pair = (name: string, value: string) => ({ name, value });

afterEach(() => vi.restoreAllMocks());

describe("buildForwardCookieHeader — identical to before for everything that works today", () => {
  const realistic = [
    pair("mefie-tickets-session", "eyJpdiI6IkhYdWJ4+Zl/OTBnPT0iLCJ2YWx1ZSI6IkFiQys5L3o9PSIsIm1hYyI6IjEyMzQ1NiJ9%3D"),
    pair("XSRF-TOKEN", "eyJpdiI6IktTRkRC+VdhNA==%3D"),
    pair("mefie_consumer_session", "a1b2c3d4e5f6"),
    pair("mefie_claim_flow", "abc%3Ddef"),
    pair("remember_web_59ba36addc2b2f9401580f014c7f58ea4e30989d", "1|abcdef|$2y$12$hash"),
    pair("_ga", "GA1.1.123456789.1700000000"),
    pair("_clck", "1abc2de|2|f1x|0|1"),
    pair("mefie_privacy_consent", JSON.stringify({ v: 2, analytics: true, marketing: false })),
  ];

  it("returns byte-for-byte what the old code returned", () => {
    expect(buildForwardCookieHeader(realistic)).toBe(previous(realistic));
  });

  it("keeps order and the `; ` separator", () => {
    expect(buildForwardCookieHeader([pair("a", "1"), pair("b", "2"), pair("c", "3")])).toBe("a=1; b=2; c=3");
  });

  it("returns an empty string for no cookies", () => {
    expect(buildForwardCookieHeader([])).toBe("");
  });

  // Every one of these is accepted by fetch today, so none may be dropped.
  it.each([
    ["accented letter U+00E9", "café"],
    ["U+00FF (the last sendable character)", "ÿ"],
    ["semicolon", "a;b=c"],
    ["comma and quotes", 'a,"b"'],
    ["inner space", "a b"],
    ["leading and trailing space", " ab "],
    ["TAB", "a\tb"],
    ["DEL", "a\u007Fb"],
    ["other control char", "a\u0001b"],
    ["base64 with + / =", "ab+cd/ef=="],
    ["percent sequence", "abc%3Ddef"],
  ])("still forwards a value with %s", (_label, value) => {
    const pairs = [pair("c", value)];
    expect(fetchAccepts(previous(pairs))).toBe(true); // sanity: it really works today
    expect(buildForwardCookieHeader(pairs)).toBe(previous(pairs));
  });
});

describe("buildForwardCookieHeader — drops only what would crash the request", () => {
  // Every one of these makes `fetch` throw today (and so used to 500 the page).
  it.each([
    ["curly apostrophe", JSON.stringify({ t: "George’s Party" })],
    ["em dash", JSON.stringify({ t: "Summer — Accra" })],
    ["ellipsis", "Wait…"],
    ["emoji", "Party \u{1F389}"],
    ["Polish letter", "Łukasz"],
    ["Chinese name", "李明"],
    ["first char above U+00FF (U+0100)", "Ā"],
    ["line feed", "a\nb"],
    ["carriage return", "a\rb"],
    ["NUL", "a\u0000b"],
  ])("drops a value containing %s", (_label, value) => {
    const pairs = [pair("c", value)];
    expect(fetchAccepts(previous(pairs))).toBe(false); // sanity: this is what used to crash
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(buildForwardCookieHeader(pairs)).toBe("");
  });

  it("keeps the neighbours of a dropped cookie, in order, and the result is always sendable", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const header = buildForwardCookieHeader([pair("session", "abc"), pair("bad", "George’s"), pair("XSRF-TOKEN", "xyz")]);
    expect(header).toBe("session=abc; XSRF-TOKEN=xyz");
    expect(fetchAccepts(header)).toBe(true);
  });

  it("drops an unsendable cookie NAME too", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(buildForwardCookieHeader([pair("na’me", "v"), pair("ok", "1")])).toBe("ok=1");
  });

  it("warns with the cookie name only, never the value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    buildForwardCookieHeader([pair("session_like", "SECRET’VALUE")]);
    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).toContain("session_like");
    expect(logged).not.toContain("SECRET");
  });
});

describe("buildForwardCookieHeader — web-only preview cookies are never forwarded", () => {
  it.each(["mefie_claim_preview", "mefie_accept_preview", "mefie_invite_preview"])("drops %s even when it is plain ASCII", (name) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(buildForwardCookieHeader([pair("session", "abc"), pair(name, '{"a":1}')])).toBe("session=abc");
    expect(warn).not.toHaveBeenCalled(); // an expected drop, not a problem worth logging
  });

  it("does not drop look-alikes that are not web-only caches", () => {
    const pairs = [pair("mefie_claim_flow", "x"), pair("mefie_preview", "y"), pair("my_claim_preview", "z")];
    expect(buildForwardCookieHeader(pairs)).toBe(previous(pairs));
  });
});
