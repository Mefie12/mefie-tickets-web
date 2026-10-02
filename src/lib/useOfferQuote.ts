"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { quoteOffers, type Quote } from "@/lib/offersApi";
import { classifyQuoteError, quoteRetryDelay, rateLimitWaitSeconds, shouldRetryQuote, type QuoteProblem } from "@/lib/quoteProblem";

type CartLine = { product_id: number; ticket_option_id: number | null; quantity: number };

/**
 * Debounced, read-only price quote for the current cart + promo input.
 * The quote is advisory: it reserves nothing, and order creation
 * recalculates everything under lock (a stale quote comes back as a 409
 * that the checkout turns into an explicit "accept the new price" step).
 *
 * `placeholderData: keepPreviousData` keeps the last price on screen
 * (flagged `isStale`) while a new one loads, so the layout never jumps.
 *
 * When a quote can't be fetched at all, `problem` says why, the last good
 * quote stays on screen flagged stale, and `retryAt` (rate limits only) is
 * when the hook will try again by itself. A failure never counts as the
 * server rejecting a code: callers must not clear a saved offer because of it.
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
    const handle = window.setTimeout(() => setDebounced(signature), 400);
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
    // The same cart + code within a few seconds (remounts, tab switches) reuses the answer instead of re-asking.
    staleTime: 15_000,
    retry: shouldRetryQuote,
    retryDelay: quoteRetryDelay,
  });

  // Remember the last quote that actually arrived, to keep showing it (flagged stale) if the next one fails.
  const [lastGood, setLastGood] = useState<Quote | undefined>();
  if (query.data && !query.isPlaceholderData && query.data !== lastGood) setLastGood(query.data);

  const failed = enabled && items.length > 0 && query.isError;
  const problem: QuoteProblem | null = failed ? classifyQuoteError(query.error) : null;

  // Rate limited: try again by itself once the server's wait is over. The deadline is derived from the failure's
  // timestamp, so a new 429 restarts the wait and no state is needed to track it.
  const { refetch } = query;
  const retryAt = problem === "RATE_LIMITED" ? query.errorUpdatedAt + rateLimitWaitSeconds(query.error) * 1000 : null;
  useEffect(() => {
    if (retryAt === null) return;
    const handle = window.setTimeout(() => void refetch(), Math.max(0, retryAt - Date.now()));
    return () => window.clearTimeout(handle);
  }, [retryAt, refetch]);

  const active = enabled && items.length > 0;
  return {
    quote: active ? (query.data ?? (failed ? lastGood : undefined)) : undefined,
    isLoading: query.isFetching,
    isStale: query.isPlaceholderData || debounced !== signature || failed,
    error: query.error,
    problem,
    retryAt,
    refetch: query.refetch,
  };
}
