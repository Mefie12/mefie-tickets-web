"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Card, Checkbox, Divider, Group, Radio, SegmentedControl, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { isValidPhoneNumber } from "libphonenumber-js";
import { ApiError } from "@/lib/authApi";
import { createOrder, type AnswerValue, type Order } from "@/lib/checkoutApi";
import type { PublicEvent } from "@/lib/publicEventApi";
import { computeBuyerCosts } from "@/lib/fees";
import { EditableQuestionField, isQuestionAnswered } from "@/components/EditableQuestionField";
import { OrderCostBreakdown } from "@/components/OrderCostBreakdown";
import { PhoneInput } from "@/components/PhoneInput";
import { TermsAndConditionsLink } from "@/components/TermsAndConditionsLink";

type CartLine = { product_id: number; ticket_option_id: number | null; product_title: string; quantity: number };

// Mirrors OrderService::TERMS_TRIGGERING_TYPES on the backend — FREE
// alone never gates on terms, but a cart mixing FREE with any of these
// still triggers it, order-level, since one line item is all it takes.
const TERMS_TRIGGERING_TYPES = new Set(["PAID", "TIERED", "REGISTRATION", "DONATION"]);

// null = not yet chosen — a non-deferred ticket must end in "me" or
// "other" before submit is allowed, there is no implicit default (see
// the redesign notes: ownership is never inferred from slot order or
// ticket position). "later" is only offered on a deferred event
// (docs/17) — the unit ships BUYER_HELD and is assigned from the portal.
type Assignment = "me" | "other" | "later" | null;

type AttendeeSlot = {
  product_id: number;
  ticket_option_id: number | null;
  product_title: string;
  assignment: Assignment;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  answers: Record<number, AnswerValue>;
};

function buildAttendeeSlots(cartItems: CartLine[], deferred: boolean): AttendeeSlot[] {
  return cartItems.flatMap((item) =>
    Array.from({ length: item.quantity }, () => ({
      product_id: item.product_id,
      ticket_option_id: item.ticket_option_id,
      product_title: item.product_title,
      assignment: (deferred ? "later" : null) as Assignment,
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      answers: {},
    })),
  );
}

/**
 * Buyer info, order-level answers, and one sub-form per purchased
 * ticket unit — all submitted together in one POST per the checkout
 * design (Milestone 6). Attendee slots are (re)built from the cart
 * whenever this step is entered; going back to the cart and returning
 * resets any attendee details already typed — a deliberate
 * simplification, not worth the state-reconciliation complexity for MVP.
 *
 * Each ticket is assigned explicitly ("Who will use this ticket?") per
 * slot, rather than inferring the buyer's own ticket from slot order —
 * fixes a real bug where a single "will you be attending?" toggle
 * always collapsed the buyer onto slot 0, which could be the wrong
 * product entirely (e.g. buyer wants the VVIP ticket but it landed
 * later in the cart than a General admission ticket).
 */
export function CheckoutDetailsForm({
  event,
  cartItems,
  totalDue,
  onOrderCreated,
  onBack,
}: {
  event: PublicEvent;
  cartItems: CartLine[];
  totalDue: number;
  onOrderCreated: (order: Order) => void;
  onBack: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [orderAnswers, setOrderAnswers] = useState<Record<number, AnswerValue>>({});
  const deferred = event.deferred_assignment_enabled;
  // Entering attendee details at checkout hands the buyer the authority to
  // accept the admission terms on each attendee's behalf — only valid when
  // the event's acceptance policy is PURCHASER_GROUP. GUARDIAN_MINOR and
  // ATTENDEE_PERSONAL require the guardian/attendee themselves to accept,
  // which can only happen after assignment (portal / personal link), so
  // those events must ship every unit "later" (docs/17 §5.3, §7.1, §7.3) —
  // offering "now" for them is what the backend's 422 on this exact form
  // was catching (OrderService::assertInlineAttendeesWithinItemQuantities).
  const inlineAssignmentOffered = deferred && event.acceptance_policy === "PURCHASER_GROUP";
  // "later" = ship every unit BUYER_HELD, no attendee entry now; "now" =
  // enter (some or all) attendees at checkout via the accordion below.
  // Keyed on `deferred` alone (not `inlineAssignmentOffered`): a
  // non-PURCHASER_GROUP deferred event must still default to — and, since
  // its picker below never renders, stay locked on — "later". Only a
  // genuinely non-deferred event (no BUYER_HELD state to ship to) forces "now".
  const [assignMode, setAssignMode] = useState<"now" | "later">(deferred ? "later" : "now");
  const [attendees, setAttendees] = useState<AttendeeSlot[]>(() => buildAttendeeSlots(cartItems, deferred));
  const [notifyAttendees, setNotifyAttendees] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsVersionChanged, setTermsVersionChanged] = useState(false);
  const checkoutIdempotencyKey = useRef(crypto.randomUUID());

  const costs = useMemo(
    () => computeBuyerCosts(Math.round(totalDue * 100), event.pricing),
    [totalDue, event.pricing],
  );

  const orderQuestions = event.questions.filter((q) => q.scope === "ORDER").sort((a, b) => a.sort_order - b.sort_order);
  const attendeeQuestions = event.questions
    .filter((q) => q.scope === "ATTENDEE")
    .sort((a, b) => a.sort_order - b.sort_order);

  const productTypeById = new Map(event.products.map((p) => [p.id, p.type]));
  const termsRequired =
    event.terms !== null && cartItems.some((item) => TERMS_TRIGGERING_TYPES.has(productTypeById.get(item.product_id) ?? ""));

  const mutation = useMutation({
    mutationFn: () =>
      createOrder(event.id, {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        checkout_idempotency_key: checkoutIdempotencyKey.current,
        items: cartItems.map((item) => ({ product_id: item.product_id, ticket_option_id: item.ticket_option_id, quantity: item.quantity })),
        order_answers: orderQuestions.map((q) => ({ question_id: q.id, answer: orderAnswers[q.id] ?? "" })),
        notify_attendees: notifyAttendees,
        ...(termsRequired && event.terms
          ? { terms_accepted: termsAccepted, terms_version_id: event.terms.version_id }
          : {}),
        // "later" slots (and the whole "assign later" mode) send nothing —
        // the backend mints them BUYER_HELD for portal assignment.
        attendees:
          assignMode === "later"
            ? []
            : attendees
                .filter((a) => a.assignment === "me" || a.assignment === "other")
                .map((a) => {
                  const isBuyerSlot = a.assignment === "me";
                  return {
                    product_id: a.product_id,
                    ticket_option_id: a.ticket_option_id,
                    first_name: isBuyerSlot ? firstName : a.first_name,
                    last_name: isBuyerSlot ? lastName : a.last_name,
                    email: isBuyerSlot ? email : a.email.trim() || null,
                    phone: isBuyerSlot ? phone : a.phone.trim() || null,
                    is_buyer: isBuyerSlot,
                    answers: attendeeQuestions.map((q) => ({ question_id: q.id, answer: a.answers[q.id] ?? "" })),
                  };
                }),
      }),
    onSuccess: (data: { order: Order }) => onOrderCreated(data.order),
    onError: (error: Error) => {
      // The version_id this form has in local state (from the initial
      // page load) no longer matches the event's current published
      // version — resubmitting as-is would just fail again, so this
      // needs a fresh page load rather than a notification to dismiss.
      if (error instanceof ApiError && error.code === "TERMS_VERSION_CHANGED") {
        setTermsVersionChanged(true);
        return;
      }
      notifications.show({
        color: "red",
        message: error instanceof ApiError ? error.message : "Something went wrong.",
      });
    },
  });

  function validate(): string | null {
    if (!firstName.trim() || !lastName.trim()) return "Enter your first and last name.";
    if (!/^\S+@\S+\.\S+$/.test(email)) return "Enter a valid email address.";
    if (!phone.trim() || !isValidPhoneNumber(phone)) return "Enter a valid phone number.";
    if (termsRequired && !termsAccepted) return "You must accept the Terms & Conditions to continue.";

    for (const q of orderQuestions) {
      if (!isQuestionAnswered(q, orderAnswers[q.id])) return `'${q.title}' is required.`;
    }

    if (assignMode === "later") return null;

    for (const a of attendees) {
      if (a.assignment === "later") continue;
      if (a.assignment === null) return `Choose who will use each ${a.product_title} ticket, or choose to assign it later.`;
      if (a.assignment === "other") {
        if (!a.first_name.trim() || !a.last_name.trim()) return `Enter a name for each ${a.product_title} attendee.`;
        if (a.email.trim() && !/^\S+@\S+\.\S+$/.test(a.email)) return `Enter a valid email for each ${a.product_title} attendee, or leave it blank.`;
        if (a.phone.trim() && !isValidPhoneNumber(a.phone)) return `Enter a valid phone number for each ${a.product_title} attendee, or leave it blank.`;
      }
      for (const q of attendeeQuestions) {
        if (!isQuestionAnswered(q, a.answers[q.id])) return `'${q.title}' is required for each attendee.`;
      }
    }

    return null;
  }

  function handleSubmit() {
    const error = validate();
    if (error) {
      notifications.show({ color: "red", message: error });
      return;
    }
    mutation.mutate();
  }

  function updateAttendee(index: number, patch: Partial<AttendeeSlot>) {
    setAttendees((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function assignSlot(index: number, assignment: "me" | "other" | "later") {
    setAttendees((prev) =>
      prev.map((a, i) => {
        if (i === index) return { ...a, assignment };
        // Only one ticket can be "me" at a time — claiming it here
        // un-assigns any other slot that previously had it, rather than
        // silently flipping it to "other" (the buyer must consciously
        // decide who that ticket is for now).
        if (assignment === "me" && a.assignment === "me") return { ...a, assignment: null };
        return a;
      }),
    );
  }

  return (
    <Stack gap="xl">
      <Stack gap="md">
        <Title order={2} fz={22}>
          Your details
        </Title>
        {/* Container query, not a viewport breakpoint: the checkout is a
            ~340px sticky sidebar on desktop and full-width on mobile, so
            first/last only pair up when the column itself has the room —
            otherwise everything stacks, which keeps every field a
            comfortable tap target. Email and phone always get their own
            row (phone needs the width for its country-code selector). */}
        <SimpleGrid type="container" cols={{ base: 1, "380px": 2 }} spacing="sm">
          <TextInput label="First name" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.currentTarget.value)} />
          <TextInput label="Last name" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.currentTarget.value)} />
        </SimpleGrid>
        <TextInput
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
        />
        <PhoneInput label="Phone" required value={phone} onChange={setPhone} />
      </Stack>

      {orderQuestions.length > 0 && (
        <Stack gap="md">
          <Divider label="Order questions" labelPosition="left" />
          {orderQuestions.map((q) => (
            <EditableQuestionField
              key={q.id}
              question={q}
              value={orderAnswers[q.id]}
              onChange={(value) => setOrderAnswers((prev) => ({ ...prev, [q.id]: value }))}
            />
          ))}
        </Stack>
      )}

      <Stack gap="md">
        <Divider label="Attendees" labelPosition="left" />

        {inlineAssignmentOffered && (
          <Radio.Group
            value={assignMode}
            onChange={(value) => setAssignMode(value as "now" | "later")}
            label="When do you want to add attendee details?"
          >
            <Stack gap="xs" mt="xs">
              <Radio
                value="later"
                label="Assign later"
                description="Complete the purchase now and assign each ticket from your account whenever you're ready. We'll email you a link."
              />
              <Radio
                value="now"
                label="Enter attendees now"
                description="Fill in who each ticket is for as part of checkout."
              />
            </Stack>
          </Radio.Group>
        )}

        {assignMode === "now" && (
          <>
        <Text size="sm" c="dimmed">
          Tell us who will use each ticket{deferred ? ", or leave individual tickets to assign later" : ""}.
        </Text>
        {attendees.map((attendee, index) => {
          const displayNumber = index + 1;
          const isBuyerSlot = attendee.assignment === "me";

          return (
            <Card key={index} withBorder radius="lg" p="md">
              <Stack gap="sm">
                <Text fw={600} size="sm">
                  Ticket {displayNumber} — {attendee.product_title}
                </Text>
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    Who will use this ticket?
                  </Text>
                  <SegmentedControl
                    size="xs"
                    value={attendee.assignment ?? ""}
                    onChange={(value) => assignSlot(index, value as "me" | "other" | "later")}
                    data={[
                      { label: "Me", value: "me" },
                      { label: "Someone else", value: "other" },
                      ...(deferred ? [{ label: "Assign later", value: "later" }] : []),
                    ]}
                  />
                </Stack>

                {isBuyerSlot && (
                  <Text size="sm" c="dimmed" style={{ overflowWrap: "anywhere" }}>
                    Using your details above: {firstName} {lastName} · {email} · {phone}
                  </Text>
                )}

                {attendee.assignment === "later" && (
                  <Text size="sm" c="dimmed">
                    You&apos;ll assign this ticket from your account later.
                  </Text>
                )}

                {attendee.assignment === "other" && (
                  <>
                    <SimpleGrid type="container" cols={{ base: 1, "380px": 2 }} spacing="sm">
                      <TextInput
                        label="First name"
                        size="sm"
                        autoComplete="off"
                        value={attendee.first_name}
                        onChange={(e) => updateAttendee(index, { first_name: e.currentTarget.value })}
                      />
                      <TextInput
                        label="Last name"
                        size="sm"
                        autoComplete="off"
                        value={attendee.last_name}
                        onChange={(e) => updateAttendee(index, { last_name: e.currentTarget.value })}
                      />
                    </SimpleGrid>
                    <TextInput
                      label="Email (optional)"
                      description="We'll send them their ticket if provided"
                      size="sm"
                      type="email"
                      inputMode="email"
                      autoComplete="off"
                      value={attendee.email}
                      onChange={(e) => updateAttendee(index, { email: e.currentTarget.value })}
                    />
                    <PhoneInput
                      label="Phone (optional)"
                      size="sm"
                      value={attendee.phone}
                      onChange={(value) => updateAttendee(index, { phone: value })}
                    />
                  </>
                )}

                {(attendee.assignment === "me" || attendee.assignment === "other") &&
                  attendeeQuestions.map((q) => (
                    <EditableQuestionField
                      key={q.id}
                      question={q}
                      value={attendee.answers[q.id]}
                      onChange={(value) =>
                        updateAttendee(index, { answers: { ...attendee.answers, [q.id]: value } })
                      }
                    />
                  ))}
              </Stack>
            </Card>
          );
        })}

        <Checkbox
          label="Notify attendees by email"
          description="If an attendee has an email address, we'll send them their own ticket and event updates. Leave this off if you'd rather keep it a surprise."
          checked={notifyAttendees}
          onChange={(e) => setNotifyAttendees(e.currentTarget.checked)}
        />
          </>
        )}

        {assignMode === "later" && (
          <Text size="sm" c="dimmed">
            All {attendees.length} {attendees.length === 1 ? "ticket" : "tickets"} will be held on your account.
            After checkout, open the link we email you to assign each one.
          </Text>
        )}
      </Stack>

      {termsRequired && event.terms && (
        <Stack gap="xs">
          <Divider label="Terms & Conditions" labelPosition="left" />
          <Checkbox
            label={
              <>
                I have read and accept the{" "}
                <TermsAndConditionsLink document={event.terms} pdfUrl={`/api/public/events/${event.id}/terms/pdf`} label="Terms & Conditions" />
              </>
            }
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.currentTarget.checked)}
          />
        </Stack>
      )}

      {termsVersionChanged && (
        <Alert color="orange" title="Terms & Conditions updated">
          <Stack gap="xs">
            <Text size="sm">
              The organizer published a new version of the Terms &amp; Conditions while you were checking out. Reload
              the page to review the latest version before continuing.
            </Text>
            <Button size="xs" style={{ alignSelf: "flex-start" }} onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </Stack>
        </Alert>
      )}

      {totalDue > 0 && (
        <Card withBorder radius="md" p="md">
          <OrderCostBreakdown
            amounts={{
              currency: event.currency_code,
              subtotalMinor: costs.subtotalMinor,
              serviceFeeMinor: costs.serviceFeeMinor,
              taxMinor: costs.taxMinor,
              totalMinor: costs.totalMinor,
            }}
          />
        </Card>
      )}

      {/* wrap-reverse: if the two don't fit on one line, the primary
          action stays on top and "Back" drops below it. */}
      <Group justify="space-between" wrap="wrap-reverse" gap="sm">
        <Button variant="subtle" color="gray" onClick={onBack} disabled={mutation.isPending}>
          Back to tickets
        </Button>
        <Button
          size="md"
          onClick={handleSubmit}
          loading={mutation.isPending}
          disabled={termsVersionChanged}
          style={{ flex: "1 1 auto" }}
        >
          {totalDue === 0 ? "Register for free" : "Continue to payment"}
        </Button>
      </Group>
    </Stack>
  );
}
