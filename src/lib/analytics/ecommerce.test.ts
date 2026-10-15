import { afterEach, describe, expect, it } from "vitest";
import type { Order } from "@/lib/checkoutApi";
import { beginCheckoutEvent, hasTrackedPurchase, parseMoney, purchaseEvent, trackBeginCheckout, trackPurchase, trackViewItemWhenReady, viewItemEvent } from "./ecommerce";
import { registerActiveAdapters } from "./runtime";
import type { AnalyticsAdapter, CommerceEvent } from "./types";

const order = (over: Partial<Order> = {}): Order => ({
  short_id: "ORD-100", status: "COMPLETED", first_name: "Ada", last_name: "L", email: "ada@example.com", phone: "0200000000",
  subtotal: "90.00", tax_amount: "10.00", platform_fee: "0", processing_fee: "0", total_amount: "100.00", currency: "ghs",
  tax_bearer: "ATTENDEE", platform_fee_bearer: "ATTENDEE", processing_fee_bearer: "ATTENDEE",
  items: [{ ticket_group_name: "GA", ticket_option_name: null, ticket_display_name: "General Admission", price: "45.00", quantity: 2, item_total: "90.00", currency_code: "GHS" }],
  attendees: [], terms_acceptance: null, unassigned_count: 0, ...over,
});

function recorder(returns = true) {
  const events: CommerceEvent[] = [];
  const adapter: AnalyticsAdapter = { id: "r", group: "product_improvement", configured: () => true, resident: () => true, start() {}, stop() {}, pageView() {}, track: (e) => { events.push(e); return returns; } };
  registerActiveAdapters(() => [adapter]);
  return events;
}

afterEach(() => registerActiveAdapters(() => []));

describe("parseMoney", () => {
  it("parses decimal strings and numbers", () => {
    expect(parseMoney("12.50")).toBe(12.5);
    expect(parseMoney(" 7 ")).toBe(7);
    expect(parseMoney(3)).toBe(3);
    expect(parseMoney("0")).toBe(0);
  });

  it("rejects anything that is not a finite non-negative amount", () => {
    for (const bad of ["", "   ", "abc", "-1", "NaN", "Infinity", null, undefined, {}, [], true]) expect(parseMoney(bad), String(bad)).toBeNull();
  });
});

describe("event builders", () => {
  it("builds view_item with an upper-case currency", () => {
    expect(viewItemEvent({ title: "Summer Fest", currency_code: "ghs" })).toEqual({ type: "view_item", currency: "GHS", items: [{ name: "Summer Fest", quantity: 1 }] });
  });

  it("builds begin_checkout from the order total and lines", () => {
    expect(beginCheckoutEvent(order())).toEqual({
      type: "begin_checkout", currency: "GHS", value: 100, items: [{ name: "General Admission", price: 45, quantity: 2 }],
    });
  });

  it("builds purchase with our order id, value, currency and tax", () => {
    expect(purchaseEvent(order())).toEqual({
      type: "purchase", transactionId: "ORD-100", currency: "GHS", value: 100, tax: 10, items: [{ name: "General Admission", price: 45, quantity: 2 }],
    });
  });

  it("omits tax when it is zero or missing, and a free order is a purchase of value 0", () => {
    expect(purchaseEvent(order({ tax_amount: "0.00" }))).not.toHaveProperty("tax");
    expect(purchaseEvent(order({ tax_amount: "" }))).not.toHaveProperty("tax");
    expect(purchaseEvent(order({ total_amount: "0.00", tax_amount: "0.00" }))).toMatchObject({ value: 0 });
  });

  it("only a COMPLETED order is a purchase", () => {
    for (const status of ["RESERVED", "CANCELLED", "ABANDONED", "AWAITING_OFFLINE_PAYMENT"] as const) {
      expect(purchaseEvent(order({ status })), status).toBeNull();
    }
  });

  it("never invents a value: no usable total or currency means no event", () => {
    expect(purchaseEvent(order({ total_amount: "n/a" }))).toBeNull();
    expect(purchaseEvent(order({ currency: "" }))).toBeNull();
    expect(beginCheckoutEvent(order({ total_amount: "-5" }))).toBeNull();
    expect(purchaseEvent(order({ short_id: "" }))).toBeNull();
  });

  it("carries no personal data about the buyer", () => {
    const json = JSON.stringify([purchaseEvent(order()), beginCheckoutEvent(order())]);
    for (const secret of ["ada@example.com", "0200000000", "Ada"]) expect(json).not.toContain(secret);
  });
});

describe("trackPurchase", () => {
  it("sends once per order and ignores repeats (reload, 3-D Secure return)", () => {
    const events = recorder();
    expect(trackPurchase(order({ short_id: "ORD-ONCE" }))).toBe(true);
    expect(trackPurchase(order({ short_id: "ORD-ONCE" }))).toBe(false);
    expect(events.filter((e) => e.type === "purchase")).toHaveLength(1);
    expect(hasTrackedPurchase("ORD-ONCE")).toBe(true);
  });

  it("sends different orders separately", () => {
    const events = recorder();
    trackPurchase(order({ short_id: "ORD-A" }));
    trackPurchase(order({ short_id: "ORD-B" }));
    expect(events.map((e) => (e as { transactionId: string }).transactionId)).toEqual(["ORD-A", "ORD-B"]);
  });

  it("does not remember an order that nobody received (no consent / no tool started)", () => {
    registerActiveAdapters(() => []);
    expect(trackPurchase(order({ short_id: "ORD-NOCONSENT" }))).toBe(false);
    expect(hasTrackedPurchase("ORD-NOCONSENT")).toBe(false);
  });

  it("does not remember an order a tool declined to send", () => {
    recorder(false);
    expect(trackPurchase(order({ short_id: "ORD-DECLINED" }))).toBe(false);
    expect(hasTrackedPurchase("ORD-DECLINED")).toBe(false);
  });

  it("an order that is not completed is never sent", () => {
    const events = recorder();
    expect(trackPurchase(order({ short_id: "ORD-RESERVED", status: "RESERVED" }))).toBe(false);
    expect(events).toHaveLength(0);
  });
});

describe("begin_checkout and view_item", () => {
  it("sends begin_checkout and reports whether anyone received it", () => {
    const events = recorder();
    expect(trackBeginCheckout(order({ status: "RESERVED" }))).toBe(true);
    expect(events[0]).toMatchObject({ type: "begin_checkout", value: 100 });
    registerActiveAdapters(() => []);
    expect(trackBeginCheckout(order())).toBe(false);
  });

  it("sends view_item as soon as a tool is started", () => {
    const events = recorder();
    trackViewItemWhenReady({ title: "Summer Fest", currency_code: "GHS" });
    expect(events).toEqual([{ type: "view_item", currency: "GHS", items: [{ name: "Summer Fest", quantity: 1 }] }]);
  });
});
