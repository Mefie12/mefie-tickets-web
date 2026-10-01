import { beforeEach, describe, expect, it } from "vitest";
import { localInputToUtcIso, utcIsoToLocalInput, zonedToUtcIso } from "@/lib/offerDates";
import { discountLabel, offersByTab, PHASE_COLOR, PHASE_LABEL, previewDiscountedUnit, shareUrl } from "@/lib/offerFormat";
import { isStaleOfferCode, offerErrorMessage } from "@/lib/offerErrors";
import { amountsFromQuote } from "@/lib/quoteAmounts";
import { expandScope, lineDiscounts } from "@/lib/offerLineBadges";
import { offerInventory, samplePriceMinor, scopeLabels } from "@/lib/offerInventory";
import { serializeCheckoutOrder, createCheckoutDraft } from "@/lib/checkoutDraft";
import { OFFER_TTL_MS, clearOffer, loadOffer, offerAfterQuote, saveOffer } from "@/lib/offerSession";
import { CART_TTL_MS, clearCart, loadCart, saveCart } from "@/lib/cartStorage";
import { maxQuantityFor, restoreQuantities } from "@/lib/ticketLimits";
import { endError, startError } from "@/lib/offerSchedule";
import { createRejectionNotifier, normalizePromoCode, promoCodeFormatError } from "@/lib/offerCodeFormat";
import type { PublicOffer, Quote } from "@/lib/offersApi";
import type { Product } from "@/lib/productApi";

const quote = (over: Partial<Quote> = {}): Quote => ({
  status: "APPLIED", code: null, message: null, needs_verification: false, currency: "USD",
  lines: [{ product_id: 1, ticket_option_id: null, quantity: 3, unit_price_minor: 10000, discounted_units: 2, discount_minor: 4000, final_total_minor: 26000 }],
  gross_subtotal_minor: 30000, discount_total_minor: 4000, subtotal_minor: 26000,
  tax_minor: 100, platform_fee_minor: 780, processing_fee_minor: 70,
  tax_bearer: "ATTENDEE", platform_fee_bearer: "ATTENDEE", processing_fee_bearer: "ORGANIZER", total_minor: 26880,
  offer: { name: "Summer", source: "code", activation: "CODE", discount_type: "PERCENTAGE", discount_value: 2000, discounted_units: 2, partially_applied: true },
  ...over,
});

describe("offer schedule time zones", () => {
  it("converts wall-clock time in the event's zone to UTC, across a DST boundary", () => {
    // London is UTC+1 in summer, UTC+0 in winter.
    expect(zonedToUtcIso("2026-07-01", "12:00", "Europe/London")).toBe("2026-07-01T11:00:00.000Z");
    expect(zonedToUtcIso("2026-12-01", "12:00", "Europe/London")).toBe("2026-12-01T12:00:00.000Z");
    expect(zonedToUtcIso("2026-07-01", "12:00", "America/New_York")).toBe("2026-07-01T16:00:00.000Z");
  });

  it("round-trips through the datetime-local input value", () => {
    const iso = "2026-07-01T11:00:00.000Z";
    const local = utcIsoToLocalInput(iso, "Europe/London");
    expect(local).toBe("2026-07-01T12:00");
    expect(localInputToUtcIso(local, "Europe/London")).toBe(iso);
  });
});

describe("offer formatting", () => {
  it("labels percentage and fixed discounts", () => {
    expect(discountLabel({ discount_type: "PERCENTAGE", discount_value: 2000, currency_code: "USD" })).toBe("20% off");
    expect(discountLabel({ discount_type: "PERCENTAGE", discount_value: 1250, currency_code: "USD" })).toBe("12.5% off");
    expect(discountLabel({ discount_type: "FIXED_PER_TICKET", discount_value: 1000, currency_code: "USD" })).toContain("10.00");
  });

  it("previews a discounted unit like the server: half-up per unit, never below zero", () => {
    expect(previewDiscountedUnit(1001, { discount_type: "PERCENTAGE", discount_value: 1000 })).toBe(901); // 10.01 - 1.00 (half-up of 100.1)
    expect(previewDiscountedUnit(3000, { discount_type: "FIXED_PER_TICKET", discount_value: 5000 })).toBe(0);
  });

  it("builds share links that append to an existing query string", () => {
    expect(shareUrl("https://x.test/o/e", "tok")).toBe("https://x.test/o/e?offer=tok");
    expect(shareUrl("https://x.test/o/e?a=1", "tok")).toBe("https://x.test/o/e?a=1&offer=tok");
  });
});

describe("offer error copy", () => {
  it("has plain-language messages and a fallback", () => {
    expect(offerErrorMessage("OFFER_CODE_INVALID")).toMatch(/isn’t valid/);
    expect(offerErrorMessage("SOMETHING_ELSE", "fallback")).toBe("fallback");
    expect(offerErrorMessage(undefined)).toMatch(/went wrong/);
  });

  it("recognises only the 409 'your quote is stale' codes", () => {
    for (const code of ["OFFER_CAPACITY_CHANGED", "OFFER_EXPIRED", "OFFER_NO_LONGER_ELIGIBLE", "OFFER_STATE_CHANGED"]) {
      expect(isStaleOfferCode(code)).toBe(true);
    }
    expect(isStaleOfferCode("OFFER_CODE_INVALID")).toBe(false);
    expect(isStaleOfferCode(null)).toBe(false);
  });
});

describe("quote → cost rows", () => {
  it("collapses buyer-borne fees into one service fee and drops absorbed ones, using the server's total", () => {
    const amounts = amountsFromQuote(quote());
    expect(amounts.subtotalMinor).toBe(30000);
    expect(amounts.discountMinor).toBe(4000);
    expect(amounts.serviceFeeMinor).toBe(780); // platform fee only; processing fee is absorbed by the organizer
    expect(amounts.taxMinor).toBe(100);
    expect(amounts.totalMinor).toBe(26880);
  });
});

describe("ticket row badges", () => {
  it("shows the server's per-line saving, flagging a partial allocation", () => {
    const badges = lineDiscounts({ quote: quote() });
    expect(badges["1:direct"].badge).toContain("40.00");
    expect(badges["1:direct"].badge).toContain("2 of 3 tickets");
  });

  it("advertises a sale on in-scope rows when nothing is selected yet", () => {
    const offer: PublicOffer = { name: "Flash", activation: "AUTOMATIC", discount_type: "PERCENTAGE", discount_value: 1500, currency_code: "USD", starts_at: "2026-01-01T00:00:00Z", ends_at: "2026-12-01T00:00:00Z", requires_verification: false, scope: [{ product_id: 7, ticket_option_id: null }] };
    const expanded = expandScope(offer, [{ id: 7, options: [{ id: 70 }, { id: 71 }] }]);
    const badges = lineDiscounts({ advertised: expanded, timezone: "Europe/London" });
    expect(Object.keys(badges).sort()).toEqual(["7:70", "7:71"]);
    expect(badges["7:70"].badge).toContain("15% off");
  });
});

describe("offer inventory", () => {
  const products = [
    { id: 1, title: "VIP", product_type: "TICKET", type: "PAID", price: "100.00", disabled_at: null, price_tiers: [] },
    { id: 2, title: "GA", product_type: "TICKET", type: "TIERED", price: null, disabled_at: null, price_tiers: [{ id: 21, name: "Early Bird", price: "40.00", is_enabled: true }, { id: 22, name: "Regular", price: "60.00", is_enabled: false }] },
    { id: 3, title: "Hidden", product_type: "TICKET", type: "PAID", price: "10.00", disabled_at: "2026-01-01", price_tiers: [] },
  ] as unknown as Product[];

  it("lists enabled ticket types and options with prices, skipping disabled products", () => {
    const inventory = offerInventory(products);
    expect(inventory.map((t) => t.title)).toEqual(["VIP", "GA"]);
    expect(inventory[1].options).toEqual([{ id: 21, name: "Early Bird", priceMinor: 4000 }]);
  });

  it("labels scopes and finds a sample price for previews", () => {
    const inventory = offerInventory(products);
    expect(scopeLabels([{ product_id: 1, ticket_option_id: null }, { product_id: 2, ticket_option_id: 21 }], inventory)).toEqual(["VIP", "GA — Early Bird"]);
    expect(samplePriceMinor([{ product_id: 2, ticket_option_id: 21 }], inventory)).toBe(4000);
    expect(samplePriceMinor([], inventory)).toBeNull();
  });
});

describe("serializing an order with an offer", () => {
  const cart = [{ product_id: 1, ticket_option_id: null, product_title: "VIP", quantity: 1 }];
  const ctx = { orderQuestions: [], attendeeQuestions: [], termsRequired: false, termsVersionId: null, checkoutIdempotencyKey: "k" };

  it("sends the code and the discount the buyer was shown, only as an assertion", () => {
    const draft = createCheckoutDraft(cart, false, false);
    const order = serializeCheckoutOrder(draft, cart, { ...ctx, offer: { promo_code: "SAVE20", expected_discount_minor: 2000 } });
    expect(order.promo_code).toBe("SAVE20");
    expect(order.offer_token).toBeUndefined();
    expect(order.expected_discount_minor).toBe(2000);
  });

  it("omits offer fields when no offer is in play, and never sends a rejected code", () => {
    const draft = createCheckoutDraft(cart, false, false);
    const plain = serializeCheckoutOrder(draft, cart, ctx);
    expect("promo_code" in plain || "expected_discount_minor" in plain).toBe(false);
    const rejected = serializeCheckoutOrder(draft, cart, { ...ctx, offer: { promo_code: null, offer_token: null, expected_discount_minor: 0 } });
    expect(rejected.promo_code).toBeUndefined();
    expect(rejected.expected_discount_minor).toBe(0);
  });
});

describe("promo code format (client-side UX only)", () => {
  const check = (raw: string) => promoCodeFormatError(normalizePromoCode(raw));

  it("treats empty as 'remove the code', not an error", () => {
    expect(normalizePromoCode("   ")).toBe("");
    expect(check("")).toBeNull();
    expect(check("   ")).toBeNull();
  });

  it("normalizes with trim + uppercase, and validates that same value", () => {
    expect(normalizePromoCode(" summer20 ")).toBe("SUMMER20");
    expect(check(" summer20 ")).toBeNull();
    expect(check("SUMMER20")).toBeNull();
    expect(check("abcd")).toBeNull();
  });

  it("flags too short, too long and bad characters with specific messages", () => {
    expect(check("abc")).toMatch(/at least 4/);
    expect(check("a".repeat(33))).toMatch(/at most 32/);
    expect(check("a".repeat(32))).toBeNull();
    expect(check("abc!")).toMatch(/letters, numbers/);
    expect(check("has space")).toMatch(/letters, numbers/);
    expect(check("ok_code-1")).toBeNull();
  });
});

describe("rejection notification", () => {
  it("fires once per attempt, not on re-renders or repeat quotes", () => {
    const notify = createRejectionNotifier();
    expect(notify(0, true, true)).toBe(false); // a code from a link/storage: inline alert only
    expect(notify(1, false, true)).toBe(false); // applied fine
    expect(notify(1, true, false)).toBe(false); // still loading (placeholder data)
    expect(notify(1, true, true)).toBe(true); // rejected → notify
    expect(notify(1, true, true)).toBe(false); // re-render of the same rejection
    expect(notify(1, true, true)).toBe(false); // repeat quote, same attempt
    expect(notify(2, true, true)).toBe(true); // a new Apply that is also rejected
    expect(notify(2, true, true)).toBe(false);
  });
});

describe("offer schedule feedback", () => {
  const tz = "Europe/London";
  const now = Date.parse("2026-07-01T12:00:00Z"); // 13:00 in London (BST)

  it("start checks: required, past beyond the 55-minute grace rejected, 'now' and the future accepted", () => {
    expect(startError("", tz, { now })).toMatch(/Choose a start/);
    expect(startError("2026-07-01T12:00", tz, { now })).toMatch(/in the past/); // 12:00 BST = 11:00Z, an hour ago
    expect(startError("2026-07-01T12:10", tz, { now })).toBeNull(); // 50 min ago (11:10Z)
    expect(startError("2026-07-01T13:30", tz, { now })).toBeNull();
  });

  it("never flags an unchanged start of an existing draft", () => {
    expect(startError("2026-06-01T09:00", tz, { now, unchangedFrom: "2026-06-01T09:00" })).toBeNull();
    expect(startError("2026-06-02T09:00", tz, { now, unchangedFrom: "2026-06-01T09:00" })).toMatch(/in the past/);
  });

  it("end checks: required, in the future, after the start", () => {
    expect(endError("2026-07-01T13:00", "", tz, now)).toMatch(/Choose an end/);
    expect(endError("2026-06-01T09:00", "2026-06-30T09:00", tz, now)).toMatch(/in the future/);
    expect(endError("2026-07-05T09:00", "2026-07-04T09:00", tz, now)).toMatch(/after the start/);
    expect(endError("2026-07-02T09:00", "2026-07-03T09:00", tz, now)).toBeNull();
  });
});

describe("persisting the applied offer", () => {
  let store: Record<string, string>;
  beforeEach(() => {
    store = {};
    (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    } as Storage;
  });

  it("round-trips the input and the last-shown discount", () => {
    saveOffer(7, { promo_code: "SUMMER20", offer_token: null, expected_discount_minor: 2000 }, 1_000);
    expect(loadOffer(7, 2_000)).toEqual({ promo_code: "SUMMER20", offer_token: null, expected_discount_minor: 2000 });
    expect(loadOffer(8, 2_000)).toBeNull(); // scoped per event
  });

  it("expires after the TTL and discards the entry", () => {
    saveOffer(7, { promo_code: "SUMMER20", expected_discount_minor: 0 }, 0);
    expect(loadOffer(7, OFFER_TTL_MS - 1)).not.toBeNull();
    expect(loadOffer(7, OFFER_TTL_MS + 1)).toBeNull();
    expect(store["mefie-offer:7"]).toBeUndefined();
  });

  it("ignores legacy, wrong-version and malformed data", () => {
    store["mefie-offer:7"] = JSON.stringify({ promo_code: "OLD", expected_discount_minor: 0 }); // pre-envelope shape
    expect(loadOffer(7)).toBeNull();
    store["mefie-offer:7"] = JSON.stringify({ v: 99, saved_at: Date.now(), offer: { promo_code: "X", expected_discount_minor: 0 } });
    expect(loadOffer(7)).toBeNull();
    store["mefie-offer:7"] = "{not json";
    expect(loadOffer(7)).toBeNull();
  });

  it("clears the entry", () => {
    saveOffer(7, { promo_code: "SUMMER20", expected_discount_minor: 0 });
    clearOffer(7);
    expect(loadOffer(7)).toBeNull();
  });

  it("reconciles with the server's answer: keep usable codes, drop rejected ones, never invent one", () => {
    const input = { promo_code: "SUMMER20", offer_token: null };
    expect(offerAfterQuote(input, { status: "APPLIED", discount_total_minor: 4000 })).toEqual({ promo_code: "SUMMER20", offer_token: null, expected_discount_minor: 4000 });
    expect(offerAfterQuote(input, { status: "VERIFICATION_REQUIRED", discount_total_minor: 0 })).toEqual({ promo_code: "SUMMER20", offer_token: null, expected_discount_minor: 0 });
    expect(offerAfterQuote(input, { status: "REJECTED", discount_total_minor: 0 })).toBe("REMOVE");
    expect(offerAfterQuote(input, { status: "NONE", discount_total_minor: 0 })).toBe("KEEP");
    // No buyer input (automatic-only quote): never writes anything.
    expect(offerAfterQuote({ promo_code: null, offer_token: null }, { status: "APPLIED", discount_total_minor: 500 })).toBe("KEEP");
  });
});

describe("persisted ticket selection", () => {
  let store: Record<string, string>;
  beforeEach(() => {
    store = {};
    (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    } as Storage;
  });

  const product = (over: Record<string, unknown>) => ({ id: 1, type: "PAID", is_on_sale: true, is_sold_out: false, quantity_remaining: null, max_attendees_per_registration: null, options: [], ...over }) as never;

  it("round-trips, expires, and ignores malformed or legacy data", () => {
    saveCart(5, [{ product_id: 1, ticket_option_id: null, quantity: 2 }], 0);
    expect(loadCart(5, 1)).toEqual([{ product_id: 1, ticket_option_id: null, quantity: 2 }]);
    expect(loadCart(5, CART_TTL_MS + 1)).toBeNull();
    expect(store["mefie-cart:5"]).toBeUndefined();
    store["mefie-cart:5"] = JSON.stringify([{ product_id: 1, ticket_option_id: null, quantity: 2 }]); // pre-envelope shape
    expect(loadCart(5)).toBeNull();
    store["mefie-cart:5"] = JSON.stringify({ v: 1, saved_at: Date.now(), items: [{ product_id: "x", quantity: 2 }, { product_id: 1, ticket_option_id: null, quantity: 0 }] });
    expect(loadCart(5)).toBeNull(); // nothing valid left
    clearCart(5);
  });

  it("restores quantities but re-validates against the live event", () => {
    const products = [
      product({ id: 1 }),
      product({ id: 2, is_sold_out: true }),
      product({ id: 3, quantity_remaining: 2 }),
      product({ id: 4, type: "TIERED", options: [{ id: 41, is_available: true, quantity_remaining: 5, max_attendees_per_registration: 3 }, { id: 42, is_available: false }] }),
    ];
    const restored = restoreQuantities([
      { product_id: 1, ticket_option_id: null, quantity: 4 },
      { product_id: 2, ticket_option_id: null, quantity: 1 }, // sold out since
      { product_id: 3, ticket_option_id: null, quantity: 9 }, // clamp to 2 remaining
      { product_id: 4, ticket_option_id: 41, quantity: 8 }, // clamp to per-order cap 3
      { product_id: 4, ticket_option_id: 42, quantity: 1 }, // option unavailable
      { product_id: 4, ticket_option_id: 99, quantity: 1 }, // option removed
      { product_id: 1, ticket_option_id: 7, quantity: 1 }, // option on a non-tiered product
      { product_id: 77, ticket_option_id: null, quantity: 1 }, // product removed
    ], products);
    expect(restored).toEqual({ "1:direct": 4, "3:direct": 2, "4:41": 3 });
  });

  it("uses one limit definition for the stepper and for restoration", () => {
    expect(maxQuantityFor(product({}), null)).toBe(10);
    expect(maxQuantityFor(product({ max_attendees_per_registration: 50, quantity_remaining: 30 }), null)).toBe(30);
  });
});

describe("offer phases and tabs", () => {
  const o = (phase: "DRAFT" | "SCHEDULED" | "LIVE" | "PAUSED" | "EXPIRED" | "ENDED") => ({ phase });
  const all = [o("LIVE"), o("LIVE"), o("SCHEDULED"), o("DRAFT"), o("PAUSED"), o("EXPIRED"), o("ENDED")];

  it("keeps Active to offers usable right now and puts Scheduled in its own tab", () => {
    expect(offersByTab(all, "LIVE")).toHaveLength(2);
    expect(offersByTab(all, "SCHEDULED")).toHaveLength(1);
  });
  it("groups expired offers with ended ones", () => {
    expect(offersByTab(all, "ENDED").map((x) => x.phase)).toEqual(["EXPIRED", "ENDED"]);
  });
  it("All shows everything and every phase has a label and colour", () => {
    expect(offersByTab(all, "ALL")).toHaveLength(7);
    for (const phase of ["DRAFT", "SCHEDULED", "LIVE", "PAUSED", "EXPIRED", "ENDED"] as const) {
      expect(PHASE_LABEL[phase]).toBeTruthy();
      expect(PHASE_COLOR[phase]).toBeTruthy();
    }
    expect(PHASE_LABEL.LIVE).toBe("Active");
  });
});
