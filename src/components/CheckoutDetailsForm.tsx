"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Card, Checkbox, Divider, Group, SegmentedControl, Stack, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { isValidPhoneNumber } from "libphonenumber-js";
import { ApiError } from "@/lib/authApi";
import { createOrder, type AnswerValue, type Order } from "@/lib/checkoutApi";
import type { PublicEvent } from "@/lib/publicEventApi";
import { EditableQuestionField, isQuestionAnswered } from "@/components/EditableQuestionField";
import { PhoneInput } from "@/components/PhoneInput";
import { TermsAndConditionsLink } from "@/components/TermsAndConditionsLink";

type CartLine = { product_id: number; ticket_option_id: number | null; product_title: string; quantity: number };

// Mirrors OrderService::TERMS_TRIGGERING_TYPES on the backend — FREE
// alone never gates on terms, but a cart mixing FREE with any of these
// still triggers it, order-level, since one line item is all it takes.
const TERMS_TRIGGERING_TYPES = new Set(["PAID", "TIERED", "REGISTRATION", "DONATION"]);

// null = not yet chosen — every ticket must end in "me" or "other" before
// submit is allowed, there is no implicit default (see the redesign notes:
// ownership is never inferred from slot order or ticket position).
type Assignment = "me" | "other" | null;

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

function buildAttendeeSlots(cartItems: CartLine[]): AttendeeSlot[] {
  return cartItems.flatMap((item) =>
    Array.from({ length: item.quantity }, () => ({
      product_id: item.product_id,
      ticket_option_id: item.ticket_option_id,
      product_title: item.product_title,
      assignment: null as Assignment,
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
  const [attendees, setAttendees] = useState<AttendeeSlot[]>(() => buildAttendeeSlots(cartItems));
  const [notifyAttendees, setNotifyAttendees] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsVersionChanged, setTermsVersionChanged] = useState(false);
  const checkoutIdempotencyKey = useRef(crypto.randomUUID());

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
        attendees: attendees.map((a) => {
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

    for (const a of attendees) {
      if (a.assignment === null) return `Choose who will use each ${a.product_title} ticket.`;
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

  function assignSlot(index: number, assignment: "me" | "other") {
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
        <Group grow>
          <TextInput label="First name" value={firstName} onChange={(e) => setFirstName(e.currentTarget.value)} />
          <TextInput label="Last name" value={lastName} onChange={(e) => setLastName(e.currentTarget.value)} />
        </Group>
        <Group grow>
          <TextInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
          <PhoneInput label="Phone" required value={phone} onChange={setPhone} />
        </Group>
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
        <Text size="sm" c="dimmed">
          Tell us who will use each ticket.
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
                    onChange={(value) => assignSlot(index, value as "me" | "other")}
                    data={[
                      { label: "Me", value: "me" },
                      { label: "Someone else", value: "other" },
                    ]}
                  />
                </Stack>

                {isBuyerSlot && (
                  <Text size="sm" c="dimmed">
                    Using your details above: {firstName} {lastName} · {email} · {phone}
                  </Text>
                )}

                {attendee.assignment === "other" && (
                  <>
                    <Group grow>
                      <TextInput
                        label="First name"
                        size="sm"
                        value={attendee.first_name}
                        onChange={(e) => updateAttendee(index, { first_name: e.currentTarget.value })}
                      />
                      <TextInput
                        label="Last name"
                        size="sm"
                        value={attendee.last_name}
                        onChange={(e) => updateAttendee(index, { last_name: e.currentTarget.value })}
                      />
                    </Group>
                    <Group grow align="flex-start">
                      <TextInput
                        label="Email (optional)"
                        description="We'll send them their ticket if provided"
                        size="sm"
                        type="email"
                        value={attendee.email}
                        onChange={(e) => updateAttendee(index, { email: e.currentTarget.value })}
                      />
                      <PhoneInput
                        label="Phone (optional)"
                        value={attendee.phone}
                        onChange={(value) => updateAttendee(index, { phone: value })}
                      />
                    </Group>
                  </>
                )}

                {attendee.assignment !== null &&
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
      </Stack>

      {termsRequired && event.terms && (
        <Stack gap="xs">
          <Divider label="Terms & Conditions" labelPosition="left" />
          <Checkbox
            label={
              <>
                I have read and accept the{" "}
                <TermsAndConditionsLink eventId={event.id} terms={event.terms} label="Terms & Conditions" />
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

      <Group justify="space-between">
        <Button variant="subtle" onClick={onBack} disabled={mutation.isPending}>
          Back to tickets
        </Button>
        <Button onClick={handleSubmit} loading={mutation.isPending} disabled={termsVersionChanged}>
          {totalDue === 0 ? "Register for free" : "Continue"}
        </Button>
      </Group>
    </Stack>
  );
}
