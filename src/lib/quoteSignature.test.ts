import { describe, expect, it } from "vitest";
import { parseQuoteSignature, quoteSignature, signatureHasItems } from "@/lib/quoteSignature";

const line = { product_id: 59, ticket_option_id: null, quantity: 1 };

describe("quote signature", () => {
  it("round-trips the cart and the offer input, defaulting missing inputs to null", () => {
    const signature = quoteSignature({ items: [line], promoCode: "SAVE20" });
    expect(parseQuoteSignature(signature)).toEqual({ items: [line], promoCode: "SAVE20", offerToken: null });
  });

  it("only a signature that holds a ticket is worth quoting", () => {
    expect(signatureHasItems(quoteSignature({ items: [] }))).toBe(false);
    expect(signatureHasItems(quoteSignature({ items: [], promoCode: "SAVE20" }))).toBe(false); // a code alone is not a cart
    expect(signatureHasItems(quoteSignature({ items: [line] }))).toBe(true);
  });

  it("changes when the cart changes, so a new quote is asked for", () => {
    expect(quoteSignature({ items: [line] })).not.toBe(quoteSignature({ items: [{ ...line, quantity: 2 }] }));
  });
});
