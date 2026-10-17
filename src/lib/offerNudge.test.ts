import { describe, expect, it } from "vitest";
import { offerNudges, type NudgeLine } from "@/lib/offerNudge";
import type { PublicOffer } from "@/lib/offersApi";

const base: PublicOffer = {
  name: "Deal", activation: "AUTOMATIC", discount_type: "GROUP_BUNDLE", discount_value: null, min_ticket_quantity: null,
  group_size: 2, group_price_minor: 35000, max_groups_per_order: null, currency_code: "USD",
  starts_at: "2026-01-01T00:00:00Z", ends_at: "2026-12-01T00:00:00Z", requires_verification: false,
  scope: [{ product_id: 1, ticket_option_id: null }],
};
const line = (over: Partial<NudgeLine> = {}): NudgeLine => ({ key: "1:direct", title: "Single", unitPriceMinor: 20000, quantity: 1, max: 10, tiered: false, ...over });
const couple = (over: Partial<PublicOffer> = {}): PublicOffer => ({ ...base, ...over });
const volume = (over: Partial<PublicOffer> = {}): PublicOffer => ({ ...base, discount_type: "PERCENTAGE", discount_value: 1500, group_size: null, group_price_minor: null, min_ticket_quantity: 3, ...over });

describe("offer nudge: group price", () => {
  it("invites a buyer holding one ticket to add the second, with the saving", () => {
    const [nudge] = offerNudges(couple(), [line()], "USD");
    expect(nudge.key).toBe("1:direct");
    expect(nudge.message).toBe("Add 1 more ticket to get 2 for US$350.00 (save US$50.00).");
  });

  it("says nothing before a ticket is picked, or once every ticket sits in a full group", () => {
    expect(offerNudges(couple(), [line({ quantity: 0 })], "USD")).toEqual([]);
    expect(offerNudges(couple(), [line({ quantity: 2 })], "USD")).toEqual([]);
    expect(offerNudges(couple(), [line({ quantity: 4 })], "USD")).toEqual([]);
  });

  it("offers another group for a leftover ticket only once the server confirms another group would be discounted", () => {
    expect(offerNudges(couple(), [line({ quantity: 3 })], "USD", true)[0].message).toBe("Add 1 more ticket to get another 2 for US$350.00.");
    // A hidden limit (per order, per customer, total) leaves no room: never promise it.
    expect(offerNudges(couple(), [line({ quantity: 3 })], "USD", false)).toEqual([]);
    // No current answer yet (quote loading or for another offer): stay quiet instead of flickering a promise.
    expect(offerNudges(couple(), [line({ quantity: 3 })], "USD", null)).toEqual([]);
  });

  it("still suggests the first group straight away, since the limits allow at least one group", () => {
    expect(offerNudges(couple(), [line({ quantity: 1 })], "USD", null)).toHaveLength(1);
  });

  it("never suggests what the buyer cannot reach", () => {
    expect(offerNudges(couple(), [line({ quantity: 1, max: 1 })], "USD")).toEqual([]); // sold out / capped at one
    expect(offerNudges(couple({ max_groups_per_order: 1 }), [line({ quantity: 3 })], "USD", true)).toEqual([]); // one pair per order already used
  });

  it("stays quiet when the group price is not actually a saving at this price", () => {
    expect(offerNudges(couple({ group_price_minor: 40000 }), [line()], "USD")).toEqual([]);
    expect(offerNudges(couple(), [line({ unitPriceMinor: 15000 })], "USD")).toEqual([]);
  });

  it("only talks about tickets the offer covers, and tells tiered buyers the option must match", () => {
    expect(offerNudges(couple(), [line({ key: "9:direct" })], "USD")).toEqual([]);
    const tiered = offerNudges(couple({ scope: [{ product_id: 1, ticket_option_id: 5 }] }), [line({ key: "1:5", tiered: true })], "USD");
    expect(tiered[0].message).toContain("same option");
  });
});

describe("offer nudge: minimum quantity", () => {
  it("shows how many more are needed for the discount, in the right words", () => {
    expect(offerNudges(volume(), [line({ quantity: 1 })], "USD")[0].message).toBe("Add 2 more tickets to get 15% off every Single ticket.");
    expect(offerNudges(volume(), [line({ quantity: 2 })], "USD")[0].message).toBe("Add 1 more ticket to get 15% off every Single ticket.");
    expect(offerNudges(volume({ discount_type: "FIXED_PER_TICKET", discount_value: 2500 }), [line({ quantity: 2 })], "USD")[0].message).toContain("US$25.00 off each");
  });

  it("stays quiet once the minimum is met, or when it cannot be reached", () => {
    expect(offerNudges(volume(), [line({ quantity: 3 })], "USD")).toEqual([]);
    expect(offerNudges(volume(), [line({ quantity: 2, max: 2 })], "USD")).toEqual([]);
  });

  it("does nothing for an ordinary offer or no offer", () => {
    expect(offerNudges(volume({ min_ticket_quantity: null }), [line()], "USD")).toEqual([]);
    expect(offerNudges(null, [line()], "USD")).toEqual([]);
  });
});
