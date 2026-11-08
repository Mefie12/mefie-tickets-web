/**
 * The cart + offer input a price quote is requested for, serialised so it can be debounced and used as a query key.
 * The hook must decide whether to ask using this SAME (debounced) value, never the live cart: the live cart can
 * already hold a ticket while the debounced copy still describes the empty cart, and asking then sends an empty
 * quote the API rejects (422), which flashed a "Couldn't check your discount" notice on the first selection.
 */
export type QuoteLine = { product_id: number; ticket_option_id: number | null; quantity: number };

export type QuoteSignatureInput = { items: QuoteLine[]; promoCode: string | null; offerToken: string | null };

export function quoteSignature(args: { items: QuoteLine[]; promoCode?: string | null; offerToken?: string | null }): string {
  return JSON.stringify({ items: args.items, promoCode: args.promoCode ?? null, offerToken: args.offerToken ?? null } satisfies QuoteSignatureInput);
}

export function parseQuoteSignature(signature: string): QuoteSignatureInput {
  return JSON.parse(signature) as QuoteSignatureInput;
}

/** True when the signature describes a cart worth quoting (at least one ticket). */
export function signatureHasItems(signature: string): boolean {
  return parseQuoteSignature(signature).items.length > 0;
}
