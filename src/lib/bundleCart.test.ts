import { describe, expect, it } from "vitest";
import {
  bundleLineKey,
  bundleSlotLines,
  maxBundleQuantity,
  maxTicketQuantityInCart,
  toApiItems,
} from "@/lib/bundleCart";
import { createCheckoutDraft, reconcileCheckoutDraft, serializeCheckoutOrder, type CheckoutCartLine } from "@/lib/checkoutDraft";
import { summaryLinesFromCart } from "@/lib/orderSummaryLines";
import { restoreQuantities } from "@/lib/ticketLimits";
import { cheapestPriceLabel, type PublicBundle, type PublicProduct } from "@/lib/publicEventApi";

const ga = {
  id: 1, title: "General Access", type: "PAID", current_price: "400.00", is_sold_out: false, is_on_sale: true,
  quantity_remaining: 12, is_low_stock: false, description: null, starts_at: null, ends_at: null,
} as unknown as PublicProduct;

const crew: PublicBundle = {
  id: 7, title: "Rave Crew", description: null, price: "1500.00", package_size: 5, price_per_person: "300.00",
  list_total: "2000.00", saving: "500.00", components: [{ product_id: 1, ticket_option_id: null, quantity: 5, label: "General Access" }],
  is_on_sale: true, status: "AVAILABLE", buyable: 2, max_per_order: null,
};

describe("bundle cart", () => {
  it("sends bundle lines as bundles and tickets as tickets", () => {
    expect(toApiItems([
      { product_id: 1, ticket_option_id: null, quantity: 2 },
      { product_id: 0, ticket_option_id: null, quantity: 1, bundle_id: 7 },
    ])).toEqual([
      { product_id: 1, ticket_option_id: null, quantity: 2 },
      { type: "bundle", bundle_id: 7, quantity: 1 },
    ]);
  });

  it("limits steppers by stock shared between a bundle and the same ticket bought directly", () => {
    // 12 GA left: one Crew (5) leaves 7 for direct GA; 3 direct GA leaves room for 1 Crew.
    expect(maxTicketQuantityInCart(10, { [bundleLineKey(7)]: 1 }, [ga], [crew], 1, null)).toBe(7);
    expect(maxBundleQuantity(crew, { "1:direct": 3 }, [ga], [crew])).toBe(1);
    expect(maxBundleQuantity(crew, {}, [ga], [crew])).toBe(2);
  });

  it("restores a stored bundle line, clamped to what can be bought", () => {
    expect(restoreQuantities([{ product_id: 0, ticket_option_id: null, quantity: 5, bundle_id: 7 }], [ga], [crew])).toEqual({ [bundleLineKey(7)]: 2 });
    expect(restoreQuantities([{ product_id: 0, ticket_option_id: null, quantity: 1, bundle_id: 99 }], [ga], [crew])).toEqual({});
  });

  it("builds one attendee slot per ticket inside the bundle, keyed apart from direct tickets", () => {
    const lines: CheckoutCartLine[] = [
      { product_id: 1, ticket_option_id: null, quantity: 1, product_title: "General Access" },
      ...bundleSlotLines(crew, 7, 1),
    ];
    const draft = createCheckoutDraft(lines, false, false);
    expect(draft.slots).toHaveLength(6);
    expect(draft.slots.filter((s) => s.line_key === "b7:1:direct")).toHaveLength(5);

    // Dropping the Crew removes its 5 slots and keeps the direct ticket's.
    const next = reconcileCheckoutDraft(draft, [lines[0]], [], false, false);
    expect(next.slots).toHaveLength(1);
    expect(next.slots[0].line_key).toBeUndefined();

    const order = serializeCheckoutOrder(
      { ...draft, firstName: "A", lastName: "B", email: "a@b.co", phone: "+14155552671", slots: draft.slots.map((s) => ({ ...s, assignment: "other", guestFirstName: "X", guestLastName: "Y" })) },
      [{ product_id: 1, ticket_option_id: null, quantity: 1, product_title: "General Access" }, { product_id: 0, ticket_option_id: null, quantity: 1, bundle_id: 7, product_title: "Rave Crew" }],
      { orderQuestions: [], attendeeQuestions: [], termsRequired: false, termsVersionId: null, checkoutIdempotencyKey: "k" },
    );
    expect(order.items).toEqual([{ product_id: 1, ticket_option_id: null, quantity: 1 }, { type: "bundle", bundle_id: 7, quantity: 1 }]);
    expect((order.attendees ?? []).filter((a) => a.line_key === "b7:1:direct")).toHaveLength(5);
  });

  it("summarises a bundle as one line at the bundle price", () => {
    const lines = summaryLinesFromCart([{ product_id: 0, ticket_option_id: null, quantity: 2, bundle_id: 7, product_title: "Rave Crew" }], [ga], "GHS", [crew]);
    expect(lines).toEqual([{ label: "Rave Crew (5 tickets)", quantity: 2, totalMinor: 300000 }]);
  });

  it("shows the cheapest bundle as the from-price only when nothing else is on sale", () => {
    expect(cheapestPriceLabel({ products: [ga], bundles: [crew], currency_code: "GHS" })).toContain("400");
    expect(cheapestPriceLabel({ products: [], bundles: [crew], currency_code: "GHS" })).toContain("1,500");
  });
});
