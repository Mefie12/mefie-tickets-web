import { afterEach, describe, expect, it } from "vitest";
import { applySensitivity, notifyAnalyticsActive, registerActiveAdapters, setSensitiveStep, trackCommerce, whenAnalyticsActive } from "./runtime";
import type { AnalyticsAdapter, CommerceEvent } from "./types";

function fake(id: string, group: AnalyticsAdapter["group"], over: Partial<AnalyticsAdapter> = {}) {
  const log: string[] = [];
  const adapter: AnalyticsAdapter = {
    id, group, configured: () => true, resident: () => true, start() {}, stop() {}, pageView() {},
    track: () => { log.push("track"); return true; },
    pause: () => { log.push("pause"); },
    resume: () => { log.push("resume"); },
    ...over,
  };
  return { adapter, log };
}
const purchase: CommerceEvent = { type: "purchase", transactionId: "ORD1", currency: "GHS", value: 10, items: [] };

afterEach(() => {
  registerActiveAdapters(() => []);
  setSensitiveStep(false);
});

describe("trackCommerce", () => {
  it("returns how many started tools actually sent the event", () => {
    const a = fake("a", "product_improvement");
    const b = fake("b", "marketing", { track: () => false });
    const c = fake("c", "product_improvement", { track: undefined });
    registerActiveAdapters(() => [a.adapter, b.adapter, c.adapter]);
    expect(trackCommerce(purchase)).toBe(1);
  });

  it("sends nothing when no tool is started", () => {
    registerActiveAdapters(() => []);
    expect(trackCommerce(purchase)).toBe(0);
  });
});

describe("sensitive step (card entry)", () => {
  it("pauses marketing tools only, and resumes them afterwards", () => {
    const ga = fake("ga4", "product_improvement");
    const meta = fake("meta", "marketing");
    registerActiveAdapters(() => [ga.adapter, meta.adapter]);

    setSensitiveStep(true);
    expect(meta.log).toEqual(["pause"]);
    expect(ga.log).toEqual([]);

    setSensitiveStep(false);
    expect(meta.log).toEqual(["pause", "resume"]);
    expect(ga.log).toEqual([]);
  });

  it("a marketing tool that starts during the card step is paused straight away", () => {
    const meta = fake("meta", "marketing");
    registerActiveAdapters(() => [meta.adapter]);
    setSensitiveStep(true);
    meta.log.length = 0;
    applySensitivity(meta.adapter);
    expect(meta.log).toEqual(["pause"]);
  });
});

describe("whenAnalyticsActive", () => {
  it("runs at once when a tool is already started", () => {
    registerActiveAdapters(() => [fake("a", "product_improvement").adapter]);
    let calls = 0;
    whenAnalyticsActive(() => { calls++; });
    expect(calls).toBe(1);
  });

  it("waits until the controller reports that tools started, then runs exactly once", () => {
    let live: AnalyticsAdapter[] = [];
    registerActiveAdapters(() => live);
    let calls = 0;
    whenAnalyticsActive(() => { calls++; });
    notifyAnalyticsActive(); // nothing started yet
    expect(calls).toBe(0);

    live = [fake("a", "product_improvement").adapter];
    notifyAnalyticsActive();
    notifyAnalyticsActive();
    expect(calls).toBe(1);
  });

  it("does not run after being unsubscribed", () => {
    let live: AnalyticsAdapter[] = [];
    registerActiveAdapters(() => live);
    let calls = 0;
    const unsubscribe = whenAnalyticsActive(() => { calls++; });
    unsubscribe();
    live = [fake("a", "product_improvement").adapter];
    notifyAnalyticsActive();
    expect(calls).toBe(0);
  });
});
