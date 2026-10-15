import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createClarityAdapter } from "./clarity";
import { createGa4Adapter } from "./ga4";

type Fake = Record<string, unknown> & { dataLayer?: unknown[][]; clarity?: ((...a: unknown[]) => void) & { q?: unknown[][] } };
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
