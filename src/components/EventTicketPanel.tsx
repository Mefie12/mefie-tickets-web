"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import { IconDiscount2, IconTicket } from "@tabler/icons-react";
import { cheapestPriceLabel, type PublicEvent } from "@/lib/publicEventApi";
import { computeBuyerCosts } from "@/lib/fees";
import { TicketSelector, ticketLineKey } from "@/components/TicketSelector";
import { OrderCostBreakdown } from "@/components/OrderCostBreakdown";
import { clearCart, loadCart, saveCart, type StoredCartItem } from "@/lib/cartStorage";
import { restoreQuantities } from "@/lib/ticketLimits";
import { clearOffer, loadOffer, offerAfterQuote, saveOffer } from "@/lib/offerSession";
import { getShareOffer, type PublicOffer } from "@/lib/offersApi";
import { useOfferQuote } from "@/lib/useOfferQuote";
import { amountsFromQuote } from "@/lib/quoteAmounts";
import { expandScope, lineDiscounts } from "@/lib/offerLineBadges";
import { discountLabel } from "@/lib/offerFormat";
import { PromoCodeField } from "@/components/PromoCodeField";
import { QuoteProblemNotice } from "@/components/QuoteProblemNotice";
import { OfferVerifyModal } from "@/components/OfferVerifyModal";

/**
 * Ticket selection only — the event page's sidebar card. Buyer
 * details, payment, and confirmation now live on the dedicated
 * `/checkout` route (see CheckoutPage.tsx); "Continue" hands the picked
 * quantities off via sessionStorage (a real navigation unmounts this
 * component, so they can't stay in React state) and pushes there.
 */
export function EventTicketPanel({ event, checkoutUrl }: { event: PublicEvent; checkoutUrl: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  // Set once the stored selection has been read back, so the persist effect below
  // never overwrites it with the initial empty state.
  const [cartHydrated, setCartHydrated] = useState(false);
  // The buyer's offer *input* — a typed code or a share-link token. What it is
  // worth is decided only by the server quote below.
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [offerToken, setOfferToken] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [quoteVersion, setQuoteVersion] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Restore the buyer's selection after a reload / coming back from checkout,
  // re-validated against the live event (unavailable lines dropped, quantities clamped).
  useEffect(() => {
    const stored = loadCart(event.id);
    Promise.resolve().then(() => {
      if (stored) setQuantities(restoreQuantities(stored, event.products));
      setCartHydrated(true);
    });
    // Restore once per event; later product data refreshes must not undo the buyer's edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  // Hydrate the offer input from ?promo= / ?offer= (campaign links), else from
  // what the buyer applied before navigating to checkout and back.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrlCode = params.get("promo")?.trim();
    const fromUrlToken = params.get("offer")?.trim();
    const stored = loadOffer(event.id);
    Promise.resolve().then(() => {
      if (fromUrlToken) setOfferToken(fromUrlToken);
      else if (fromUrlCode) setPromoCode(fromUrlCode);
      else if (stored) {
        setPromoCode(stored.promo_code ?? null);
        setOfferToken(stored.offer_token ?? null);
      }
    });
  }, [event.id]);

  const shareOffer = useQuery<PublicOffer | null>({
    queryKey: ["share-offer", event.id, offerToken],
    queryFn: async () => getShareOffer(event.id, offerToken as string).then((r) => r.offer).catch(() => null),
    enabled: offerToken !== null,
    staleTime: 60_000,
  });

  const cartItems = useMemo(
    () =>
      event.products.flatMap((product) => {
        const lines = product.type === "TIERED" ? (product.options ?? []) : [null];
        return lines.flatMap((option) => {
          const quantity = quantities[ticketLineKey(product.id, option?.id ?? null)] ?? 0;
          return quantity > 0 ? [{ product_id: product.id, ticket_option_id: option?.id ?? null, quantity } satisfies StoredCartItem] : [];
        });
      }),
    [event.products, quantities],
  );

  // Keep the stored selection in step with the stepper (an empty selection clears it).
  useEffect(() => {
    if (!cartHydrated) return;
    if (cartItems.length > 0) saveCart(event.id, cartItems);
    else clearCart(event.id);
  }, [cartHydrated, cartItems, event.id]);

  const quoteEnabled = promoCode !== null || offerToken !== null || event.automatic_offer !== null;
  const { quote, isLoading: quoting, isStale: quoteStale, problem: quoteProblem, retryAt: quoteRetryAt, refetch: refetchQuote } = useOfferQuote({
    eventId: event.id,
    items: cartItems,
    promoCode,
    offerToken,
    enabled: quoteEnabled,
    version: quoteVersion,
  });
  // Rows the sale visibly covers even before anything is selected.
  const advertised = useMemo(() => {
    const offer = shareOffer.data ?? event.automatic_offer;
    return offer ? expandScope(offer, event.products) : null;
  }, [shareOffer.data, event.automatic_offer, event.products]);
  const badges = useMemo(() => lineDiscounts({ quote, advertised, timezone: event.timezone }), [quote, advertised, event.timezone]);

  // Persist the buyer's offer as soon as the server has answered for the
  // CURRENT input (not a placeholder from the previous one): keep a usable
  // code with the discount now shown, drop one the server rejected.
  const quoteSettled = !quoting && !quoteStale;
  useEffect(() => {
    if (!quoteSettled || !quote) return;
    const next = offerAfterQuote({ promo_code: promoCode, offer_token: offerToken }, quote);
    if (next === "REMOVE") clearOffer(event.id);
    else if (next !== "KEEP") saveOffer(event.id, next);
  }, [quoteSettled, quote, promoCode, offerToken, event.id]);

  const total = useMemo(() => {
    return event.products.reduce((sum, product) => {
      if (product.type !== "TIERED") return sum + Number(product.current_price ?? 0) * (quantities[ticketLineKey(product.id, null)] ?? 0);
      return sum + (product.options ?? []).reduce((optionTotal, option) =>
        optionTotal + Number(option.price) * (quantities[ticketLineKey(product.id, option.id)] ?? 0), 0);
    }, 0);
  }, [event.products, quantities]);

  // All-in figures shown up front (mandatory fees + tax included), so the
  // "Total" the buyer sees before Continue is the amount they'll actually
  // pay — matches the server order to the penny (frozen rates + identical
  // integer maths, see src/lib/fees.ts).
  const costs = useMemo(
    () => computeBuyerCosts(Math.round(total * 100), event.pricing),
    [total, event.pricing],
  );
  // With an offer in play the quote is authoritative; without one (or while
  // the first quote loads) the exact local maths above is shown as before.
  const amounts = quote
    ? amountsFromQuote(quote)
    : { currency: event.currency_code, subtotalMinor: costs.subtotalMinor, serviceFeeMinor: costs.serviceFeeMinor, taxMinor: costs.taxMinor, totalMinor: costs.totalMinor };
  const discountName = quote?.offer?.name ?? null;

  // "Available" whenever at least one line a buyer could actually pick
  // still has stock — mirrors the same is_on_sale/is_sold_out/option
  // availability rules TicketSelector uses per line, just rolled up to
  // one panel-level status.
  const anyAvailable = event.products.some((product) =>
    product.type === "TIERED"
      ? (product.options ?? []).some((option) => option.is_available)
      : product.is_on_sale && !product.is_sold_out,
  );
  const startingPrice = cheapestPriceLabel(event);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="nowrap">
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            Tickets from
          </Text>
          <Text fz={28} fw={600} style={{ lineHeight: 1 }}>
            {startingPrice ?? "—"}
          </Text>
        </Stack>
        <Group gap={8} wrap="nowrap">
          <div style={{ width: 8, height: 8, borderRadius: 999, background: anyAvailable ? "#18794e" : "var(--mantine-color-gray-6)" }} />
          <Text size="sm" c={anyAvailable ? "#18794e" : "dimmed"}>
            {anyAvailable ? "Tickets available" : "Sold out"}
          </Text>
        </Group>
      </Group>
      {offerToken !== null && !bannerDismissed && !shareOffer.isPending && (
        shareOffer.data ? (
          <Alert color="teal" variant="light" radius="md" icon={<IconDiscount2 size={18} />} role="status"
            withCloseButton onClose={() => setBannerDismissed(true)} closeButtonLabel="Dismiss">
            <Text size="sm" fw={600}>Offer applied: {shareOffer.data.name}</Text>
            <Text size="xs">{discountLabel(shareOffer.data)} on eligible tickets</Text>
          </Alert>
        ) : (
          <Alert color="gray" variant="light" radius="md" role="status" withCloseButton onClose={() => { setBannerDismissed(true); setOfferToken(null); }} closeButtonLabel="Dismiss">
            <Text size="sm">This offer is no longer available. Regular prices apply.</Text>
          </Alert>
        )
      )}
      <TicketSelector
        lineDiscounts={badges}
        products={event.products}
        quantities={quantities}
        onQuantityChange={(productId, optionId, qty) => setQuantities((prev) => ({ ...prev, [ticketLineKey(productId, optionId)]: qty }))}
        currencyCode={event.currency_code}
      />

      <PromoCodeField
        appliedCode={promoCode}
        usingShareLink={offerToken !== null}
        quote={quote}
        loading={quoting && !quoteStale}
        settled={quoteSettled}
        // Remember the typed input right away (the buyer's intent survives a reload even before
        // the quote returns, or while the cart is empty); the effect above reconciles it with the
        // server's answer.
        onApply={(code) => { setOfferToken(null); setPromoCode(code); saveOffer(event.id, { promo_code: code, offer_token: null, expected_discount_minor: 0 }); }}
        onRemove={() => { setPromoCode(null); if (offerToken !== null) { setOfferToken(null); setBannerDismissed(true); } clearOffer(event.id); }}
        onVerify={() => setVerifyOpen(true)}
      />
      <QuoteProblemNotice problem={quoteProblem} retryAt={quoteRetryAt} retrying={quoting} onRetry={() => void refetchQuote()} />

      {cartItems.length > 0 && (
        <Stack gap="xs" pt="sm" style={{ opacity: quoteStale ? 0.6 : 1, transition: "opacity 120ms" }} aria-busy={quoteStale}>
          <OrderCostBreakdown amounts={{ ...amounts, discountLabel: discountName }} />
        </Stack>
      )}

      <Button
        size="md"
        fullWidth
        disabled={cartItems.length === 0}
        onClick={() => {
          saveCart(event.id, cartItems);
          // Carry the offer input and the discount the buyer was shown to checkout.
          // A rejected typed code is never carried forward.
          const codeIsGood = quote?.status === "APPLIED" && quote.offer && quote.offer.source !== "automatic";
          saveOffer(event.id, quote && quote.status !== "NONE"
            ? {
                promo_code: codeIsGood ? promoCode : null,
                offer_token: codeIsGood ? offerToken : null,
                expected_discount_minor: quote.discount_total_minor,
              }
            : promoCode || offerToken ? { promo_code: promoCode, offer_token: offerToken, expected_discount_minor: 0 } : null);
          router.push(checkoutUrl);
        }}
      >
        {cartItems.length === 0 ? "Select at least one ticket" : "Continue"}
      </Button>

      <OfferVerifyModal opened={verifyOpen} onClose={() => setVerifyOpen(false)} onVerified={() => setQuoteVersion((v) => v + 1)} returnPath={pathname} />

      <Group gap={8} wrap="nowrap" align="flex-start">
        <IconTicket size={16} style={{ flexShrink: 0, marginTop: 3 }} />
        <Text size="xs" c="dimmed">
          Secure checkout. Inventory is held for {event.reservation_hold_minutes} minutes while you pay.
        </Text>
      </Group>
    </Stack>
  );
}
