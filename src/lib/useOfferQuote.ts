"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { quoteOffers, type Quote } from "@/lib/offersApi";

type CartLine = { product_id: number; ticket_option_id: number | null; quantity: number };

/**
 * Debounced, read-only price quote for the current cart + promo input.
 * The quote is advisory: it reserves nothing, and order creation
 * recalculates everything under lock (a stale quote comes back as a 409
 * that the checkout turns into an explicit "accept the new price" step).
 *
 * `placeholderData: keepPreviousData` keeps the last price on screen
 * (flagged `isStale`) while a new one loads, so the layout never jumps.
 */
export function useOfferQuote(args: {
  eventId: number;
  items: CartLine[];
  promoCode?: string | null;
  offerToken?: string | null;
  enabled: boolean;
  /** Bump to force a fresh quote (after verifying, or accepting a new price). */
  version?: number;
}) {
  const { eventId, items, promoCode, offerToken, enabled, version = 0 } = args;
  const signature = JSON.stringify({ items, promoCode: promoCode ?? null, offerToken: offerToken ?? null });
  const [debounced, setDebounced] = useState(signature);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(signature), 250);
    return () => window.clearTimeout(handle);
  }, [signature]);

  const query = useQuery<Quote>({
    queryKey: ["offer-quote", eventId, debounced, version],
    queryFn: async () => {
      const parsed = JSON.parse(debounced) as { items: CartLine[]; promoCode: string | null; offerToken: string | null };
      const { quote } = await quoteOffers(eventId, {
        items: parsed.items,
        promo_code: parsed.promoCode,
        offer_token: parsed.offerToken,
      });
      return quote;
    },
    enabled: enabled && items.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 0,
    retry: false,
  });

  return {
    quote: enabled && items.length > 0 ? query.data : undefined,
    isLoading: query.isFetching,
    isStale: query.isPlaceholderData || debounced !== signature,
    error: query.error,
    refetch: query.refetch,
  };
}
