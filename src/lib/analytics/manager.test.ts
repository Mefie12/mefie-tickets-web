import { describe, expect, it } from "vitest";
import { planAnalytics, type AdapterState } from "./manager";

const ga4 = (over: Partial<AdapterState> = {}): AdapterState => ({ id: "ga4", group: "product_improvement", configured: true, resident: false, active: false, ...over });
const clarity = (over: Partial<AdapterState> = {}): AdapterState => ({ id: "clarity", group: "product_improvement", configured: true, resident: false, active: false, ...over });
const pixel = (over: Partial<AdapterState> = {}): AdapterState => ({ id: "meta", group: "marketing", configured: true, resident: false, active: false, ...over });
const PI = { productImprovement: true, marketing: false };
const NONE = { productImprovement: false, marketing: false };
const plan = (pathname: string, choices: typeof PI, adapters: AdapterState[], pathChanged = false) => planAnalytics({ pathname, choices, adapters, pathChanged });

describe("planAnalytics", () => {
  it("starts nothing without consent", () => {
    expect(plan("/acme/fest", NONE, [ga4(), clarity()])).toEqual({ reload: false, start: [], stop: [] });
  });

  it("starts the tools of an accepted group on a public page", () => {
    expect(plan("/acme/fest", PI, [ga4(), clarity()])).toEqual({ reload: false, start: ["ga4", "clarity"], stop: [] });
  });

  it("never starts a tool that is not configured", () => {
    expect(plan("/acme/fest", PI, [ga4({ configured: false }), clarity()]).start).toEqual(["clarity"]);
  });

  it("keeps the two consent groups apart: marketing tools need the marketing choice", () => {
    expect(plan("/acme/fest", PI, [ga4(), pixel()]).start).toEqual(["ga4"]);
    expect(plan("/acme/fest", { productImprovement: false, marketing: true }, [ga4(), pixel()]).start).toEqual(["meta"]);
  });

  it("starts nothing on a non-public or token page, even with consent", () => {
    for (const path of ["/dashboard", "/login", "/t/abc", "/claim/x", "/reset-password"]) {
      expect(plan(path, PI, [ga4(), clarity()]), path).toEqual({ reload: false, start: [], stop: [] });
    }
  });

  it("forces a full page load when a non-public page is entered while a vendor script is still resident", () => {
    const live = [ga4({ resident: true, active: true }), clarity({ resident: true, active: true })];
    expect(plan("/dashboard", PI, live, true)).toEqual({ reload: true, start: [], stop: ["ga4", "clarity"] });
    expect(plan("/t/token", PI, live, true).reload).toBe(true);
  });

  it("a page load on a non-public page needs no further reload (nothing is resident)", () => {
    expect(plan("/dashboard", PI, [ga4(), clarity()]).reload).toBe(false);
  });

  it("withdrawing consent stops the tool at once but only reloads on the next navigation", () => {
    const live = [ga4({ resident: true, active: true })];
    expect(plan("/acme/fest", NONE, live, false)).toEqual({ reload: false, start: [], stop: ["ga4"] });
    const stopped = [ga4({ resident: true, active: false })];
    expect(plan("/acme/fest", NONE, stopped, false).reload).toBe(false);
    expect(plan("/acme/other", NONE, stopped, true).reload).toBe(true);
  });

  it("granting consent again resumes a stopped-but-resident tool without a reload", () => {
    const stopped = [ga4({ resident: true, active: false })];
    expect(plan("/acme/fest", PI, stopped, false)).toEqual({ reload: false, start: ["ga4"], stop: [] });
  });

  it("stops only the group whose consent was withdrawn", () => {
    const live = [ga4({ resident: true, active: true }), pixel({ resident: true, active: true })];
    expect(plan("/acme/fest", PI, live).stop).toEqual(["meta"]);
  });
});
