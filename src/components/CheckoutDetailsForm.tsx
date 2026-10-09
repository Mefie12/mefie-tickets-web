"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Checkbox, Divider, Group, Pagination, Radio, SegmentedControl, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { EmailTypoHint } from "@/components/EmailTypoHint";
import { ApiError } from "@/lib/authApi";
import { createOrder, type AnswerValue, type Order } from "@/lib/checkoutApi";
import type { PublicEvent } from "@/lib/publicEventApi";
import { computeBuyerCosts } from "@/lib/fees";
import type { Quote } from "@/lib/offersApi";
import type { StoredOffer } from "@/lib/offerSession";
import { amountsFromQuote } from "@/lib/quoteAmounts";
import { isStaleOfferCode, offerErrorMessage } from "@/lib/offerErrors";
import { StaleOfferPanel } from "@/components/StaleOfferPanel";
import { OfferVerifyModal } from "@/components/OfferVerifyModal";
import { EditableQuestionField } from "@/components/EditableQuestionField";
import { LegalDocumentLinksLine } from "@/components/LegalDocumentLinks";
import { OrderCostBreakdown } from "@/components/OrderCostBreakdown";
import { PhoneInput } from "@/components/PhoneInput";
import { TermsAndConditionsLink } from "@/components/TermsAndConditionsLink";
import {
  ATTENDEE_PAGE_SIZE,
  slotAnswers,
  slotComplete,
  validateCheckoutDraft,
  serializeCheckoutOrder,
  type AttendeeSlot,
  type CheckoutCartLine,
  type CheckoutDraft,
  type SlotAssignment,
} from "@/lib/checkoutDraft";
import classes from "./checkoutDetailsForm.module.css";

const TERMS_TRIGGERING_TYPES = new Set(["PAID", "TIERED", "REGISTRATION", "DONATION"]);

export function CheckoutDetailsForm({ event, cartItems, totalDue, draft, onDraftChange, onEditTickets, onOrderCreated, quote, quoteLoading, offer, onRemoveOffer, onRequote, onVerified, backUrl }: {
  event: PublicEvent;
  cartItems: CheckoutCartLine[];
  totalDue: number;
  draft: CheckoutDraft;
  onDraftChange: (updater: (current: CheckoutDraft) => CheckoutDraft) => void;
  onEditTickets: () => void;
  onOrderCreated: (order: Order) => void;
  /** Advisory server quote for the cart + applied offer; undefined when no offer is in play. */
  quote?: Quote;
  quoteLoading: boolean;
  /** The buyer's stored offer input (typed code / share token). */
  offer: StoredOffer | null;
  onRemoveOffer: () => void;
  /** Fetch a fresh quote now (after a 409). */
  onRequote: () => Promise<Quote | undefined>;
  onVerified: () => void;
  backUrl: string;
}) {
  const deferred = event.deferred_assignment_enabled;
  const inlineAssignmentOffered = deferred && event.acceptance_policy === "PURCHASER_GROUP";
  const [termsVersionChanged, setTermsVersionChanged] = useState(false);
  const [page, setPage] = useState(1);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [announcement, setAnnouncement] = useState("");
  const checkoutIdempotencyKey = useRef(crypto.randomUUID());
  const costs = useMemo(() => computeBuyerCosts(Math.round(totalDue * 100), event.pricing), [totalDue, event.pricing]);
  const [stale, setStale] = useState<{ code: string; previousTotalMinor: number | null } | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  // The quote the NEXT order attempt asserts against. A ref so "Continue at
  // new price" can swap in the fresh quote and submit in the same tick.
  const quoteRef = useRef<Quote | undefined>(quote);
  useEffect(() => { quoteRef.current = quote; }, [quote]);
  // A typed code the server rejected is never sent with the order.
  const rejected = quote?.status === "REJECTED";
  const needsVerification = quote?.status === "VERIFICATION_REQUIRED" && (offer?.promo_code || offer?.offer_token);
  const amounts = quote ? amountsFromQuote(quote) : { currency: event.currency_code, ...costs };
  const payableMinor = quote ? quote.total_minor : Math.round(totalDue * 100);
  const orderQuestions = event.questions.filter((q) => q.scope === "ORDER").sort((a, b) => a.sort_order - b.sort_order);
  const attendeeQuestions = event.questions.filter((q) => q.scope === "ATTENDEE").sort((a, b) => a.sort_order - b.sort_order);
  const productTypeById = new Map(event.products.map((p) => [p.id, p.type]));
  const termsRequired = event.terms !== null && cartItems.some((item) => TERMS_TRIGGERING_TYPES.has(productTypeById.get(item.product_id) ?? ""));
  const pageCount = Math.max(1, Math.ceil(draft.slots.length / ATTENDEE_PAGE_SIZE));
  const activePage = Math.min(page, pageCount);
  const visibleSlots = draft.slots.slice((activePage - 1) * ATTENDEE_PAGE_SIZE, activePage * ATTENDEE_PAGE_SIZE);
  const deferredCount = draft.assignmentMode === "later" ? draft.slots.length : draft.slots.filter((slot) => slot.assignment === "later").length;
  const completedCount = draft.assignmentMode === "later" ? 0 : draft.slots.filter((slot) => slot.assignment !== "later" && slotComplete(slot, attendeeQuestions, draft)).length;
  const incompleteCount = draft.assignmentMode === "later" ? 0 : draft.slots.length - completedCount - deferredCount;

  const questionContext = { orderQuestions, attendeeQuestions, termsRequired };

  const mutation = useMutation({
    mutationFn: () => {
      const q = quoteRef.current;
      return createOrder(event.id, serializeCheckoutOrder(draft, cartItems, {
        ...questionContext,
        termsVersionId: event.terms?.version_id ?? null,
        // A new key per attempt that asserts a different price: the same key
        // with changed details would (correctly) be refused as a conflict.
        checkoutIdempotencyKey: checkoutIdempotencyKey.current,
        offer: q ? {
          promo_code: q.status === "REJECTED" ? null : offer?.promo_code,
          offer_token: q.status === "REJECTED" ? null : offer?.offer_token,
          expected_discount_minor: q.discount_total_minor,
        } : null,
      }));
    },
    onSuccess: (data: { order: Order }) => onOrderCreated(data.order),
    onError: (error: Error) => {
      if (error instanceof ApiError && error.code === "TERMS_VERSION_CHANGED") return setTermsVersionChanged(true);
      if (error instanceof ApiError && isStaleOfferCode(error.code)) {
        // The failed attempt never created an order, but its idempotency key
        // is now bound to the old assertion — take a fresh one for the retry.
        checkoutIdempotencyKey.current = crypto.randomUUID();
        setStale({ code: error.code as string, previousTotalMinor: quoteRef.current?.total_minor ?? null });
        void onRequote();
        return;
      }
      if (error instanceof ApiError && error.code === "OFFER_VERIFICATION_REQUIRED") return setVerifyOpen(true);
      if (error instanceof ApiError && error.code?.startsWith("OFFER_")) {
        checkoutIdempotencyKey.current = crypto.randomUUID();
        setOfferError(offerErrorMessage(error.code, error.message));
        void onRequote();
        return;
      }
      if (error instanceof ApiError && error.status === 429) {
        // Our own rate limit, not the buyer's fault — nothing was charged or reserved.
        return notifications.show({ color: "yellow", title: "Please wait a moment", message: `Lots of people are checking out right now. Try again in ${error.retryAfter ?? 10} seconds.` });
      }
      notifications.show({ color: "red", message: error instanceof ApiError ? error.message : "Something went wrong." });
    },
  });

  async function acceptNewPrice() {
    const fresh = await onRequote();
    if (fresh) quoteRef.current = fresh;
    setStale(null);
    mutation.mutate();
  }

  const changeDraft = (patch: Partial<CheckoutDraft>) => onDraftChange((current) => ({ ...current, ...patch }));

  function updateSlot(clientId: string, patch: Partial<AttendeeSlot>, interaction: "guest" | "guestAnswers" | "buyerAnswers") {
    onDraftChange((current) => ({
      ...current,
      assignmentInteracted: true,
      slots: current.slots.map((slot) => slot.clientId === clientId ? {
        ...slot,
        ...patch,
        guestTouched: slot.guestTouched || interaction === "guest",
        guestAnswersTouched: slot.guestAnswersTouched || interaction === "guestAnswers",
        buyerAnswersTouched: slot.buyerAnswersTouched || interaction === "buyerAnswers",
      } : slot),
    }));
  }

  function touchAssignment(clientId?: string) {
    onDraftChange((current) => ({
      ...current,
      assignmentInteracted: true,
      slots: clientId ? current.slots.map((slot) => slot.clientId === clientId ? { ...slot, assignmentTouched: true } : slot) : current.slots,
    }));
  }

  function assignSlot(clientId: string, assignment: Exclude<SlotAssignment, null>) {
    const movedFrom = assignment === "me" ? draft.slots.find((slot) => slot.clientId !== clientId && slot.assignment === "me") : undefined;
    if (movedFrom) setAnnouncement(`Your ticket was moved. ${movedFrom.product_title} is now set to Someone else.`);
    onDraftChange((current) => {
      return {
        ...current,
        assignmentInteracted: true,
        slots: current.slots.map((slot) => {
          if (slot.clientId === clientId) return { ...slot, assignment, assignmentTouched: true };
          if (assignment === "me" && slot.assignment === "me") return { ...slot, assignment: "other", assignmentTouched: true };
          return slot;
        }),
      };
    });
  }

  function focusSlot(index: number) {
    const slot = draft.slots[index];
    setPage(Math.floor(index / ATTENDEE_PAGE_SIZE) + 1);
    setCollapsed((current) => { const next = new Set(current); next.delete(slot.clientId); return next; });
    window.setTimeout(() => {
      const card = document.getElementById(`attendee-slot-${slot.clientId}`);
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
      card?.querySelector<HTMLElement>("input, textarea, button")?.focus();
    }, 0);
  }

  function submit() {
    const error = validateCheckoutDraft(draft, questionContext);
    if (error) {
      notifications.show({ color: "red", message: error.message });
      if (error.slotIndex !== undefined) focusSlot(error.slotIndex);
      return;
    }
    mutation.mutate();
  }

  return <Stack gap="xl">
    <Stack gap="md">
      <Title order={2} fz={22}>1. Buyer Details</Title>
      <SimpleGrid type="container" cols={{ base: 1, "380px": 2 }} spacing="sm">
        <TextInput label="First name" withAsterisk autoComplete="given-name" value={draft.firstName} onChange={(e) => changeDraft({ firstName: e.currentTarget.value })} />
        <TextInput label="Last name" withAsterisk autoComplete="family-name" value={draft.lastName} onChange={(e) => changeDraft({ lastName: e.currentTarget.value })} />
      </SimpleGrid>
      <Stack gap={4}><TextInput label="Email" withAsterisk type="email" inputMode="email" autoComplete="email" value={draft.email} onChange={(e) => changeDraft({ email: e.currentTarget.value })} /><EmailTypoHint email={draft.email} onUse={(email) => changeDraft({ email })} /></Stack>
      <PhoneInput label="Phone" required value={draft.phone} onChange={(phone) => changeDraft({ phone })} />
    </Stack>

    {orderQuestions.length > 0 && <Stack gap="md"><Divider label="Order questions" labelPosition="left" />{orderQuestions.map((q) => <EditableQuestionField key={q.id} question={q} value={draft.orderAnswers[q.id]} onChange={(answer) => changeDraft({ orderAnswers: { ...draft.orderAnswers, [q.id]: answer } })} />)}</Stack>}

    <Stack gap="md">
      <Group justify="space-between"><Divider label="Attendees" labelPosition="left" style={{ flex: 1 }} /><Button variant="subtle" size="xs" onClick={onEditTickets}>Edit tickets</Button></Group>
      {inlineAssignmentOffered && <Radio.Group value={draft.assignmentMode} onChange={(value) => changeDraft({ assignmentMode: value as "now" | "later", assignmentInteracted: true })} label="When do you want to add attendee details?">
        <Stack gap="xs" mt="xs" onPointerDown={() => touchAssignment()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") touchAssignment(); }}>
          <Radio value="now" label="Add attendee details now" description="Tell us who will use each ticket. You can still leave individual tickets for later." />
          <Radio value="later" label="Add attendee details later" description="Complete your purchase now and assign tickets from your account afterward." />
        </Stack>
      </Radio.Group>}
      {deferred && <Text size="sm" c="dimmed">
        You can manage attendee details after purchase, subject to the event&apos;s rules and assignment deadline
        {event.admission_closes_at ? ` (${new Date(event.admission_closes_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: event.timezone })})` : ""}.
      </Text>}
      {draft.slots.length > ATTENDEE_PAGE_SIZE && <Group gap="xs">
        {draft.assignmentMode === "now" && <><Badge color="teal" variant="light">{completedCount} complete</Badge><Badge color={incompleteCount ? "orange" : "gray"} variant="light">{incompleteCount} need attention</Badge></>}
        {deferred && <Badge color="blue" variant="light">{deferredCount} for later</Badge>}
      </Group>}
      <Text aria-live="polite" className={classes.srOnly}>{announcement}</Text>

      {draft.assignmentMode === "now" && <>
        {visibleSlots.map((slot) => {
          const index = draft.slots.findIndex((candidate) => candidate.clientId === slot.clientId);
          const complete = slotComplete(slot, attendeeQuestions, draft);
          const isCollapsed = collapsed.has(slot.clientId);
          const answers = slotAnswers(slot);
          return <Card id={`attendee-slot-${slot.clientId}`} key={slot.clientId} withBorder radius="lg" p="md"><Stack gap="sm">
            <Group justify="space-between" align="center"><Text fw={600} size="sm">Ticket {index + 1} — {slot.product_title}</Text>{complete && <Button variant="subtle" size="compact-xs" onClick={() => setCollapsed((current) => { const next = new Set(current); if (next.has(slot.clientId)) next.delete(slot.clientId); else next.add(slot.clientId); return next; })}>{isCollapsed ? "Edit" : "Collapse"}</Button>}</Group>
            {isCollapsed ? <Text size="sm" c="dimmed">{slot.assignment === "me" ? `Me · ${draft.firstName} ${draft.lastName}` : slot.assignment === "other" ? `${slot.guestFirstName} ${slot.guestLastName}` : "Add attendee details later"}</Text> : <>
              <Stack gap={4} onPointerDown={() => touchAssignment(slot.clientId)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") touchAssignment(slot.clientId); }}><Text size="xs" c="dimmed">Who will use this ticket?</Text><SegmentedControl size="xs" value={slot.assignment ?? ""} onChange={(value) => assignSlot(slot.clientId, value as Exclude<SlotAssignment, null>)} data={[{ label: "Me", value: "me" }, { label: "Someone else", value: "other" }, ...(deferred ? [{ label: "Later", value: "later" }] : [])]} /></Stack>
              {slot.assignment === "me" && <Text size="sm" c="dimmed" style={{ overflowWrap: "anywhere" }}>Using your buyer details: {draft.firstName} {draft.lastName} · {draft.email} · {draft.phone}</Text>}
              {slot.assignment === "later" && <Text size="sm" c="dimmed">You&apos;ll add attendee details for this ticket from your account later.</Text>}
              {slot.assignment === "other" && <>
                <SimpleGrid type="container" cols={{ base: 1, "380px": 2 }} spacing="sm"><TextInput label="First name" withAsterisk size="sm" autoComplete="off" value={slot.guestFirstName} onChange={(e) => updateSlot(slot.clientId, { guestFirstName: e.currentTarget.value }, "guest")} /><TextInput label="Last name" withAsterisk size="sm" autoComplete="off" value={slot.guestLastName} onChange={(e) => updateSlot(slot.clientId, { guestLastName: e.currentTarget.value }, "guest")} /></SimpleGrid>
                <Stack gap={4}><TextInput label="Email (optional)" description="We'll send them their ticket if provided" size="sm" type="email" inputMode="email" autoComplete="off" value={slot.guestEmail} onChange={(e) => updateSlot(slot.clientId, { guestEmail: e.currentTarget.value }, "guest")} /><EmailTypoHint email={slot.guestEmail} onUse={(guestEmail) => updateSlot(slot.clientId, { guestEmail }, "guest")} /></Stack>
                <PhoneInput label="Phone (optional)" size="sm" value={slot.guestPhone} onChange={(guestPhone) => updateSlot(slot.clientId, { guestPhone }, "guest")} />
              </>}
              {(slot.assignment === "me" || slot.assignment === "other") && attendeeQuestions.map((q) => <EditableQuestionField key={q.id} question={q} value={answers[q.id]} onChange={(answer: AnswerValue) => updateSlot(slot.clientId, slot.assignment === "me" ? { buyerAnswers: { ...slot.buyerAnswers, [q.id]: answer } } : { guestAnswers: { ...slot.guestAnswers, [q.id]: answer } }, slot.assignment === "me" ? "buyerAnswers" : "guestAnswers")} />)}
            </>}
          </Stack></Card>;
        })}
        {pageCount > 1 && <Pagination total={pageCount} value={activePage} onChange={setPage} withEdges />}
        <Checkbox label="Notify attendees by email" description="If an attendee has an email address, we'll send them their own ticket and event updates." checked={draft.notifyAttendees} onChange={(e) => changeDraft({ notifyAttendees: e.currentTarget.checked })} />
      </>}
      {draft.assignmentMode === "later" && <Text size="sm" c="dimmed">All {draft.slots.length} {draft.slots.length === 1 ? "ticket" : "tickets"} will be held on your account. After checkout, use the link we email you to add attendee details.</Text>}
    </Stack>

    <Stack className={classes.legalDisclosures} gap={8}>
      {termsRequired && event.terms && <Checkbox classNames={{ root: classes.terms, body: classes.termsBody, input: classes.termsInput, label: classes.termsLabel }} size="md" radius="xs" color="#93C01F" label={<>I have read and accepted this organizer&apos;s <TermsAndConditionsLink document={event.terms} pdfUrl={`/api/public/events/${event.id}/terms/pdf`} label="Terms & Conditions" className={classes.termsLink} /></>} checked={draft.termsAccepted} onChange={(e) => changeDraft({ termsAccepted: e.currentTarget.checked })} />}
      <LegalDocumentLinksLine placement="ticket-checkout" className={classes.platformLegalNotice} linkClassName={classes.termsLink} />
    </Stack>
    {termsVersionChanged && <Alert color="orange" title="Terms & Conditions updated"><Stack gap="xs"><Text size="sm">The organizer published new Terms &amp; Conditions. Reload to review them before continuing.</Text><Button size="xs" style={{ alignSelf: "flex-start" }} onClick={() => window.location.reload()}>Reload page</Button></Stack></Alert>}
    {(totalDue > 0) && <Card withBorder radius="md" p="md" aria-busy={quoteLoading} style={{ opacity: quoteLoading ? 0.7 : 1, transition: "opacity 120ms" }}><OrderCostBreakdown amounts={{ ...amounts, discountLabel: quote?.offer?.name ?? null }} /></Card>}
    {offerError && <Alert color="red" role="alert" withCloseButton onClose={() => setOfferError(null)} title="Offer not applied"><Group justify="space-between" gap="xs"><Text size="sm">{offerError}</Text>{(offer?.promo_code || offer?.offer_token) && <Button size="compact-xs" variant="default" onClick={() => { setOfferError(null); onRemoveOffer(); }}>Remove code</Button>}</Group></Alert>}
    {rejected && !offerError && !stale && <Alert color="orange" role="status" title="Code not applied"><Group justify="space-between" gap="xs"><Text size="sm">{offerErrorMessage(quote?.code, quote?.message ?? undefined)}</Text><Button size="compact-xs" variant="default" onClick={onRemoveOffer}>Remove code</Button></Group></Alert>}
    {needsVerification && <Alert color="blue" role="status" title="Verify your email"><Group justify="space-between" gap="xs"><Text size="sm">This offer is limited per customer. Verify your email to use it.</Text><Group gap="xs"><Button size="compact-xs" onClick={() => setVerifyOpen(true)}>Verify email</Button><Button size="compact-xs" variant="default" onClick={onRemoveOffer}>Remove code</Button></Group></Group></Alert>}
    {stale && <StaleOfferPanel code={stale.code} currency={event.currency_code} previousTotalMinor={stale.previousTotalMinor} newTotalMinor={quote?.total_minor ?? null} busy={mutation.isPending || quoteLoading} onAccept={() => void acceptNewPrice()} onBack={() => { window.location.assign(backUrl); }} />}
    <OfferVerifyModal opened={verifyOpen} onClose={() => setVerifyOpen(false)} onVerified={onVerified} returnPath={typeof window === "undefined" ? backUrl : window.location.pathname} defaultEmail={draft.email} />
    <Group justify="space-between" wrap="wrap-reverse" gap="sm"><Button variant="subtle" color="gray" onClick={onEditTickets} disabled={mutation.isPending}>Edit tickets</Button><Button size="md" onClick={submit} loading={mutation.isPending} disabled={termsVersionChanged || !!needsVerification || !!stale} style={{ flex: "1 1 auto" }}>{payableMinor === 0 ? (totalDue === 0 ? "Register for free" : "Complete registration") : "Continue to payment"}</Button></Group>
  </Stack>;
}
