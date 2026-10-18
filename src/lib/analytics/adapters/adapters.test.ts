import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createClarityAdapter } from "./clarity";
import { createGa4Adapter } from "./ga4";
import { createMetaPixelAdapter } from "./meta";
import { createTikTokPixelAdapter } from "./tiktok";
import type { CommerceEvent } from "../types";

type Fake = Record<string, unknown> & { dataLayer?: unknown[][]; clarity?: ((...a: unknown[]) => void) & { q?: unknown[][] }; fbq?: { queue?: unknown[][] }; ttq?: unknown[][] & Record<string, unknown> };
let win: Fake;
let scripts: string[];
let cookie: string;
let expired: string[];

beforeEach(() => {
  scripts = [];
  cookie = "_ga=GA1.1.1; _ga_ABC123=GS1; keep=1";
  expired = [];
  win = { location: { hostname: "shop.mefie-tickets.com" }, setTimeout: (fn: () => void) => { fn(); return 0; } };
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = win;
  const doc: Record<string, unknown> = {
    title: "Summer Fest",
    head: { appendChild: (s: { src: string }) => { scripts.push(s.src); } },
    createElement: () => ({}),
    querySelector: (sel: string) => (scripts.some((s) => sel.includes(s)) ? {} : null),
  };
  Object.defineProperty(doc, "cookie", {
    get: () => cookie,
    set: (v: string) => { if (/Max-Age=0/.test(v)) expired.push(v.split(";")[0].replace(/=$/, "")); },
  });
  g.document = doc;
});

afterEach(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  delete g.window;
  delete g.document;
});

describe("GA4 adapter", () => {
  it("is inert without a measurement id", () => {
    const ga = createGa4Adapter(undefined);
    expect(ga.configured()).toBe(false);
    ga.start();
    expect(win.dataLayer).toBeUndefined();
    expect(scripts).toEqual([]);
  });

  it("sets consent mode defaults BEFORE config, turns off automatic page views and ad signals, and loads the tag once", () => {
    const ga = createGa4Adapter("G-TEST123");
    ga.start();
    ga.start();

    const calls = (win.dataLayer ?? []).map((a) => Array.from(a as unknown as unknown[]));
    expect(calls.map((c) => c[0])).toEqual(["consent", "js", "config"]);
    expect(calls[0][2]).toEqual({ ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "granted" });
    expect(calls[2]).toEqual(["config", "G-TEST123", { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false }]);
    expect(scripts).toEqual(["https://www.googletagmanager.com/gtag/js?id=G-TEST123"]);
    expect(ga.resident()).toBe(true);
  });

  it("sends page views with a scrubbed location (campaign tags only)", () => {
    const ga = createGa4Adapter("G-TEST123");
    ga.start();
    ga.pageView("https://mefie-tickets.com/acme/fest?utm_source=whatsapp&order=ABC123&token=secret#x");

    const last = Array.from((win.dataLayer ?? []).at(-1) as unknown as unknown[]);
    expect(last[0]).toBe("event");
    expect(last[1]).toBe("page_view");
    expect(last[2]).toEqual({ page_location: "https://mefie-tickets.com/acme/fest?utm_source=whatsapp", page_path: "/acme/fest", page_title: "Summer Fest" });
  });

  it("does not send a page view before it has started", () => {
    const ga = createGa4Adapter("G-TEST123");
    ga.pageView("https://mefie-tickets.com/acme/fest");
    expect(win.dataLayer).toBeUndefined();
  });

  it("stop sets Google's disable flag, removes only GA cookies, and silences page views until restarted", () => {
    const ga = createGa4Adapter("G-TEST123");
    ga.start();
    ga.stop();

    expect(win["ga-disable-G-TEST123"]).toBe(true);
    expect(expired.some((c) => c.startsWith("_ga=") || c === "_ga")).toBe(true);
    expect(expired.some((c) => c.startsWith("_ga_ABC123"))).toBe(true);
    expect(expired.some((c) => c.startsWith("keep"))).toBe(false);

    const before = win.dataLayer?.length;
    ga.pageView("https://mefie-tickets.com/acme/fest");
    expect(win.dataLayer?.length).toBe(before);

    ga.start();
    expect(win["ga-disable-G-TEST123"]).toBe(false);
    expect(scripts).toHaveLength(1); // resumed without loading the tag again
  });
});

describe("Clarity adapter", () => {
  it("is inert without a project id", () => {
    const c = createClarityAdapter(undefined);
    c.start();
    c.stop();
    expect(c.configured()).toBe(false);
    expect(win.clarity).toBeUndefined();
    expect(scripts).toEqual([]);
  });

  it("loads the tag once and passes consent v2 with ad storage denied", () => {
    const c = createClarityAdapter("proj123");
    c.start();
    c.start();

    expect(scripts).toEqual(["https://www.clarity.ms/tag/proj123"]);
    const queued = (win.clarity?.q ?? []).map((a) => Array.from(a as unknown as unknown[]));
    expect(queued[0]).toEqual(["consentv2", { ad_Storage: "denied", analytics_Storage: "granted" }]);
    expect(c.resident()).toBe(true);
  });

  it("stop erases consent (cookies + session) and start grants it again", () => {
    const c = createClarityAdapter("proj123");
    c.start();
    c.stop();
    c.start();

    const queued = (win.clarity?.q ?? []).map((a) => Array.from(a as unknown as unknown[]));
    expect(queued.map((q) => q[0])).toEqual(["consentv2", "consent", "consentv2"]);
    expect(queued[1]).toEqual(["consent", false]);
  });

  it("does nothing on stop if it never started", () => {
    const c = createClarityAdapter("proj123");
    c.stop();
    expect(win.clarity).toBeUndefined();
  });
});

const view: CommerceEvent = { type: "view_item", currency: "GHS", items: [{ name: "Summer Fest", quantity: 1 }] };
const checkout: CommerceEvent = { type: "begin_checkout", currency: "GHS", value: 100, items: [{ name: "General Admission", price: 45, quantity: 2 }] };
const purchase: CommerceEvent = { type: "purchase", transactionId: "ORD-1", currency: "GHS", value: 100, tax: 10, items: [{ name: "General Admission", price: 45, quantity: 2 }] };
const calls = (queue: unknown[] | undefined) => (queue ?? []).map((a) => Array.from(a as unknown as unknown[]));

describe("shopping events: GA4", () => {
  it("sends view_item, begin_checkout and purchase with e-commerce fields", () => {
    const ga = createGa4Adapter("G-TEST123");
    ga.start();
    expect(ga.track?.(view)).toBe(true);
    expect(ga.track?.(checkout)).toBe(true);
    expect(ga.track?.(purchase)).toBe(true);

    const events = calls(win.dataLayer).filter((c) => c[0] === "event");
    expect(events[0]).toEqual(["event", "view_item", { currency: "GHS", items: [{ item_name: "Summer Fest", quantity: 1 }] }]);
    expect(events[1]).toEqual(["event", "begin_checkout", { currency: "GHS", value: 100, items: [{ item_name: "General Admission", price: 45, quantity: 2 }] }]);
    expect(events[2]).toEqual(["event", "purchase", { transaction_id: "ORD-1", currency: "GHS", value: 100, tax: 10, items: [{ item_name: "General Admission", price: 45, quantity: 2 }] }]);
  });

  it("sends nothing before it starts or after it stops", () => {
    const ga = createGa4Adapter("G-TEST123");
    expect(ga.track?.(purchase)).toBe(false);
    ga.start();
    ga.stop();
    expect(ga.track?.(purchase)).toBe(false);
  });
});

describe("shopping events: Clarity", () => {
  it("sends only the funnel marker name", () => {
    const c = createClarityAdapter("proj123");
    expect(c.track?.(purchase)).toBe(false); // not started
    c.start();
    expect(c.track?.(purchase)).toBe(true);
    const last = calls(win.clarity?.q).at(-1);
    expect(last).toEqual(["event", "purchase"]);
  });
});

describe("Meta Pixel adapter", () => {
  it("is inert without a pixel id", () => {
    const m = createMetaPixelAdapter(undefined);
    m.start();
    expect(m.configured()).toBe(false);
    expect(win.fbq).toBeUndefined();
    expect(scripts).toEqual([]);
  });

  it("revokes consent before init (as Meta documents), turns auto configuration off, then grants and loads once", () => {
    const m = createMetaPixelAdapter("1234567890");
    m.start();
    m.start();

    expect(calls(win.fbq?.queue).map((c) => c.slice(0, 2))).toEqual([
      ["consent", "revoke"], ["set", "autoConfig"], ["init", "1234567890"], ["consent", "grant"], ["consent", "grant"],
    ]);
    expect(calls(win.fbq?.queue)[1]).toEqual(["set", "autoConfig", false, "1234567890"]);
    expect(scripts).toEqual(["https://connect.facebook.net/en_US/fbevents.js"]);
    expect(m.group).toBe("marketing");
  });

  it("sends only PageView, InitiateCheckout and Purchase, with value and currency and no names or personal data", () => {
    const m = createMetaPixelAdapter("1234567890");
    m.start();
    m.pageView("https://mefie-tickets.com/acme/fest");
    expect(m.track?.(view)).toBe(false); // view_item never goes to an advertising pixel
    expect(m.track?.(checkout)).toBe(true);
    expect(m.track?.(purchase)).toBe(true);

    const sent = calls(win.fbq?.queue).filter((c) => c[0] === "track");
    expect(sent).toEqual([
      ["track", "PageView"],
      ["track", "InitiateCheckout", { value: 100, currency: "GHS" }],
      ["track", "Purchase", { value: 100, currency: "GHS" }, { eventID: "ORD-1" }],
    ]);
    expect(JSON.stringify(sent)).not.toContain("General Admission");
    expect(JSON.stringify(sent)).not.toContain("Summer Fest");
  });

  it("pauses (revoke) and resumes (grant) for the card-entry step, sending nothing while paused", () => {
    const m = createMetaPixelAdapter("1234567890");
    m.start();
    m.pause?.();
    expect(m.track?.(purchase)).toBe(false);
    m.pageView("https://mefie-tickets.com/acme/fest");
    m.resume?.();
    expect(m.track?.(purchase)).toBe(true);

    const consent = calls(win.fbq?.queue).filter((c) => c[0] === "consent").map((c) => c[1]);
    expect(consent.slice(-2)).toEqual(["revoke", "grant"]);
    expect(calls(win.fbq?.queue).filter((c) => c[0] === "track").map((c) => c[1])).toEqual(["Purchase"]);
  });

  it("stop revokes consent and removes only its own cookies", () => {
    cookie = "_fbp=fb.1.2; _fbc=fb.1.3; _ga=keep";
    const m = createMetaPixelAdapter("1234567890");
    m.start();
    m.stop();

    expect(calls(win.fbq?.queue).at(-1)).toEqual(["consent", "revoke"]);
    expect(expired.some((c) => c.startsWith("_fbp"))).toBe(true);
    expect(expired.some((c) => c.startsWith("_fbc"))).toBe(true);
    expect(expired.some((c) => c.startsWith("_ga"))).toBe(false);
    expect(m.track?.(purchase)).toBe(false);
  });
});

describe("TikTok Pixel adapter", () => {
  it("is inert without a pixel id", () => {
    const t = createTikTokPixelAdapter(undefined);
    t.start();
    expect(t.configured()).toBe(false);
    expect(win.ttq).toBeUndefined();
    expect(scripts).toEqual([]);
  });

  it("loads the pixel once and grants consent", () => {
    const t = createTikTokPixelAdapter("TTPIXEL123");
    t.start();
    t.start();

    expect(scripts).toEqual(["https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=TTPIXEL123&lib=ttq"]);
    expect(calls(win.ttq).map((c) => c[0])).toEqual(["grantConsent", "grantConsent"]);
    expect(t.group).toBe("marketing");
  });

  it("sends only page, InitiateCheckout and CompletePayment with value and currency, no names", () => {
    const t = createTikTokPixelAdapter("TTPIXEL123");
    t.start();
    t.pageView("https://mefie-tickets.com/acme/fest");
    expect(t.track?.(view)).toBe(false);
    expect(t.track?.(checkout)).toBe(true);
    expect(t.track?.(purchase)).toBe(true);

    const sent = calls(win.ttq).filter((c) => c[0] === "page" || c[0] === "track");
    expect(sent).toEqual([
      ["page"],
      ["track", "InitiateCheckout", { value: 100, currency: "GHS" }],
      ["track", "CompletePayment", { value: 100, currency: "GHS" }, { event_id: "ORD-1" }],
    ]);
    expect(JSON.stringify(sent)).not.toContain("General Admission");
  });

  it("pauses and resumes with revoke/grant, sending nothing while paused", () => {
    const t = createTikTokPixelAdapter("TTPIXEL123");
    t.start();
    t.pause?.();
    expect(t.track?.(purchase)).toBe(false);
    t.resume?.();
    expect(t.track?.(purchase)).toBe(true);
    expect(calls(win.ttq).map((c) => c[0]).filter((m) => /Consent/.test(String(m))).slice(-2)).toEqual(["revokeConsent", "grantConsent"]);
  });

  it("stop revokes consent and removes only its own cookies", () => {
    cookie = "_ttp=abc; ttclid=x; _ga=keep";
    const t = createTikTokPixelAdapter("TTPIXEL123");
    t.start();
    t.stop();

    expect(calls(win.ttq).at(-1)).toEqual(["revokeConsent"]);
    expect(expired.some((c) => c.startsWith("_ttp"))).toBe(true);
    expect(expired.some((c) => c.startsWith("_ga"))).toBe(false);
    expect(t.track?.(purchase)).toBe(false);
  });
});
