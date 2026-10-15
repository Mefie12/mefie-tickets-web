import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CONSENT_VERSION,
  currentChoices,
  needsDecision,
  parseCookieMarker,
  readConsent,
  readMarketingConsentCookie,
  readPrivacyConsentCookie,
  writeConsent,
  type StoredConsent,
} from "./privacyConsent";

let store: Record<string, string>;
let cookie: string;
let listeners: Array<() => void>;

beforeEach(() => {
  store = {};
  cookie = "";
  listeners = [];
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = {
    localStorage: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    },
    dispatchEvent: () => { listeners.forEach((l) => l()); return true; },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const doc = {} as { cookie: string };
  Object.defineProperty(doc, "cookie", {
    get: () => cookie,
    set: (v: string) => { cookie = v.split(";")[0]; },
  });
  g.document = doc;
});

afterEach(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  delete g.window;
  delete g.document;
});

const seed = (over: Partial<StoredConsent> = {}) => {
  store["mefie-privacy-consent"] = JSON.stringify({
    consent_version: CONSENT_VERSION, necessary: true, product_improvement: true, marketing: false, marketing_offered: false, decided_at: "2026-10-15T10:00:00.000Z", ...over,
  });
};

describe("readConsent", () => {
  it("returns null (UNKNOWN) when nothing is stored", () => {
    expect(readConsent()).toBeNull();
  });

  it("treats a version-1 record, made under the old wording, as UNKNOWN so the banner re-asks", () => {
    store["mefie-privacy-consent"] = JSON.stringify({ consent_version: 1, necessary: true, product_improvement: true, decided_at: "2026-01-01T00:00:00Z" });
    expect(readConsent()).toBeNull();
  });

  it("fails closed on malformed or wrongly shaped storage", () => {
    for (const bad of ["not json", "null", "[]", JSON.stringify({ consent_version: CONSENT_VERSION }), JSON.stringify({ consent_version: CONSENT_VERSION, product_improvement: "yes", marketing: false, marketing_offered: false })]) {
      store["mefie-privacy-consent"] = bad;
      expect(readConsent(), bad).toBeNull();
    }
  });

  it("returns a valid current record", () => {
    seed({ product_improvement: false });
    expect(readConsent()).toMatchObject({ consent_version: CONSENT_VERSION, product_improvement: false, marketing: false });
  });
});

describe("writeConsent", () => {
  it("never grants marketing when no marketing tool is configured, and flags it as not offered", () => {
    const record = writeConsent({ productImprovement: true, marketing: true }, false);
    expect(record).toMatchObject({ product_improvement: true, marketing: false, marketing_offered: false });
    expect(currentChoices(readConsent())).toEqual({ productImprovement: true, marketing: false });
  });

  it("stores a marketing choice when a marketing tool is configured", () => {
    writeConsent({ productImprovement: true, marketing: true }, true);
    expect(readConsent()).toMatchObject({ marketing: true, marketing_offered: true });
    expect(currentChoices(readConsent())).toEqual({ productImprovement: true, marketing: true });
  });

  it("notifies same-tab listeners", () => {
    let calls = 0;
    listeners.push(() => { calls++; });
    writeConsent({ productImprovement: false, marketing: false }, false);
    expect(calls).toBe(1);
  });
});

describe("needsDecision", () => {
  it("is true with no record, false once decided", () => {
    expect(needsDecision(null, false)).toBe(true);
    seed();
    expect(needsDecision(readConsent(), false)).toBe(false);
  });

  it("asks again, once, when a marketing tool is enabled after the visitor decided without it", () => {
    seed({ marketing_offered: false });
    expect(needsDecision(readConsent(), true)).toBe(true);
    writeConsent({ productImprovement: true, marketing: false }, true);
    expect(needsDecision(readConsent(), true)).toBe(false);
  });

  it("an earlier 'accept all' can never count as marketing consent for a pixel enabled later", () => {
    writeConsent({ productImprovement: true, marketing: true }, false); // accept all, no pixel configured
    expect(currentChoices(readConsent()).marketing).toBe(false);
  });
});

describe("cookie marker (read synchronously by the Sentry gate)", () => {
  it("round-trips through writeConsent", () => {
    writeConsent({ productImprovement: true, marketing: true }, true);
    expect(cookie).toBe(`mefie_privacy_consent=${CONSENT_VERSION}|pi=1&mk=1&of=1`);
    expect(readPrivacyConsentCookie()).toBe(true);
    expect(readMarketingConsentCookie()).toBe(true);
  });

  it("the Sentry gate follows Product improvement only, never Marketing", () => {
    writeConsent({ productImprovement: false, marketing: true }, true);
    expect(readPrivacyConsentCookie()).toBe(false);
    expect(readMarketingConsentCookie()).toBe(true);
    writeConsent({ productImprovement: true, marketing: false }, true);
    expect(readPrivacyConsentCookie()).toBe(true);
    expect(readMarketingConsentCookie()).toBe(false);
  });

  it("fails closed on the old version-1 marker, other versions and garbage", () => {
    for (const marker of ["1|all", "1|necessary", `${CONSENT_VERSION + 1}|pi=1&mk=0&of=0`, "garbage", "2|pi=2&mk=0&of=0", ""]) {
      cookie = `mefie_privacy_consent=${marker}`;
      expect(readPrivacyConsentCookie(), marker).toBe(false);
      expect(readMarketingConsentCookie(), marker).toBe(false);
    }
  });

  it("survives being written as a real cookie (a semicolon in the value would truncate it)", () => {
    writeConsent({ productImprovement: true, marketing: true }, true);
    const value = cookie.slice("mefie_privacy_consent=".length);
    expect(value).not.toMatch(/[;, ]/);
    expect(parseCookieMarker(value)).toEqual({ productImprovement: true, marketing: true, marketingOffered: true });
  });

  it("a marketing flag without 'offered' is not marketing consent", () => {
    expect(parseCookieMarker(`${CONSENT_VERSION}|pi=1&mk=1&of=0`)).toMatchObject({ marketing: false });
  });

  it("reads nothing when cookies are unavailable", () => {
    (globalThis as unknown as Record<string, unknown>).document = undefined;
    expect(readPrivacyConsentCookie()).toBe(false);
  });
});
