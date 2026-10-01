import { beforeEach, describe, expect, it } from "vitest";
import { createCheckoutDraft, reconcileCheckoutDraft, type CheckoutCartLine } from "@/lib/checkoutDraft";
import { DRAFT_TTL_MS, clearCheckoutDraft, draftHasUserInput, loadCheckoutDraft, saveCheckoutDraft, sanitizeDraft } from "@/lib/checkoutDraftStorage";

const line = (quantity: number, over: Partial<CheckoutCartLine> = {}): CheckoutCartLine =>
  ({ product_id: 1, ticket_option_id: null, product_title: "GA", quantity, ...over });

let store: Record<string, string>;
beforeEach(() => {
  store = {};
  (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  } as Storage;
});

function typedDraft(quantity = 3) {
  const draft = createCheckoutDraft([line(quantity)], false, false);
  draft.firstName = "Ada";
  draft.email = "ada@example.com";
  draft.termsAccepted = true;
  draft.slots[1].assignment = "other";
  draft.slots[1].guestFirstName = "Grace";
  draft.slots[1].guestAnswers = { 5: "vegan" };
  return draft;
}

describe("checkout draft storage", () => {
  it("never writes an untouched form, and clears a previously stored one when it is reset", () => {
    saveCheckoutDraft(1, createCheckoutDraft([line(2)], false, false));
    expect(store["mefie-checkout-draft:1"]).toBeUndefined();
    saveCheckoutDraft(1, typedDraft());
    expect(store["mefie-checkout-draft:1"]).toBeDefined();
    saveCheckoutDraft(1, createCheckoutDraft([line(2)], false, false));
    expect(store["mefie-checkout-draft:1"]).toBeUndefined();
  });

  it("round-trips what was typed — but never the Terms & Conditions consent", () => {
    saveCheckoutDraft(1, typedDraft());
    expect(JSON.parse(store["mefie-checkout-draft:1"]).draft.termsAccepted).toBe(false);
    const restored = loadCheckoutDraft(1)!;
    expect(restored.firstName).toBe("Ada");
    expect(restored.email).toBe("ada@example.com");
    expect(restored.slots[1]).toMatchObject({ assignment: "other", guestFirstName: "Grace", guestAnswers: { 5: "vegan" } });
    expect(restored.termsAccepted).toBe(false);
  });

  it("expires, and is scoped per event", () => {
    saveCheckoutDraft(1, typedDraft(), 0);
    expect(loadCheckoutDraft(2, 1)).toBeNull();
    expect(loadCheckoutDraft(1, DRAFT_TTL_MS - 1)).not.toBeNull();
    expect(loadCheckoutDraft(1, DRAFT_TTL_MS + 1)).toBeNull();
    expect(store["mefie-checkout-draft:1"]).toBeUndefined(); // expired data is discarded, not left behind
  });

  it("discards wrong-version, malformed and structurally invalid data", () => {
    store["mefie-checkout-draft:1"] = JSON.stringify({ v: 99, saved_at: Date.now(), draft: typedDraft() });
    expect(loadCheckoutDraft(1)).toBeNull();
    store["mefie-checkout-draft:1"] = "{nope";
    expect(loadCheckoutDraft(1)).toBeNull();
    store["mefie-checkout-draft:1"] = JSON.stringify({ v: 1, saved_at: Date.now(), draft: { firstName: "x", slots: "not-an-array" } });
    expect(loadCheckoutDraft(1)).toBeNull();
  });

  it("rebuilds untrusted data field by field instead of casting it", () => {
    const hostile = sanitizeDraft({
      firstName: 42, lastName: "L", email: null, phone: "1", termsAccepted: true, notifyAttendees: "yes", assignmentMode: "weird",
      orderAnswers: { "7": { address_line1: "a", city: "c", state: "s", postal_code: "p", country: "GB" }, "8": { nope: 1 }, x: "ignored-key" },
      slots: [{ clientId: "c1", product_id: 1, ticket_option_id: null, product_title: "GA", assignment: "hacker", guestFirstName: 5, guestAnswers: { "3": ["a", "b"], "4": [1] } }],
    })!;
    expect(hostile.firstName).toBe("");
    expect(hostile.email).toBe("");
    expect(hostile.termsAccepted).toBe(false);
    expect(hostile.notifyAttendees).toBe(true);
    expect(hostile.assignmentMode).toBe("now");
    expect(Object.keys(hostile.orderAnswers)).toEqual(["7"]);
    expect(hostile.slots[0].assignment).toBeNull();
    expect(hostile.slots[0].guestFirstName).toBe("");
    expect(hostile.slots[0].guestAnswers).toEqual({ 3: ["a", "b"] });
    expect(sanitizeDraft({ slots: [{ clientId: "", product_id: 1 }] })).toBeNull();
  });

  it("is cleared explicitly", () => {
    saveCheckoutDraft(1, typedDraft());
    clearCheckoutDraft(1);
    expect(loadCheckoutDraft(1)).toBeNull();
  });

  it("detects user input", () => {
    expect(draftHasUserInput(createCheckoutDraft([line(1)], false, false))).toBe(false);
    expect(draftHasUserInput(typedDraft())).toBe(true);
  });
});

describe("restoring into a different cart", () => {
  it("keeps what was typed when the cart is unchanged", () => {
    saveCheckoutDraft(1, typedDraft(3));
    const next = reconcileCheckoutDraft(loadCheckoutDraft(1)!, [line(3)], [], false, false);
    expect(next.slots).toHaveLength(3);
    expect(next.slots[1].guestFirstName).toBe("Grace");
  });

  it("trims to a smaller cart and adds blank slots for a bigger one, keeping the buyer's details", () => {
    saveCheckoutDraft(1, typedDraft(3));
    const smaller = reconcileCheckoutDraft(loadCheckoutDraft(1)!, [line(2)], [], false, false);
    expect(smaller.slots).toHaveLength(2);
    expect(smaller.slots[1].guestFirstName).toBe("Grace");
    expect(smaller.firstName).toBe("Ada");
    const bigger = reconcileCheckoutDraft(loadCheckoutDraft(1)!, [line(5)], [], false, false);
    expect(bigger.slots).toHaveLength(5);
    expect(bigger.slots[4].guestFirstName).toBe("");
  });
});
