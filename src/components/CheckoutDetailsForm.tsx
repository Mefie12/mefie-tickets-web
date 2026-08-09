"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, Card, Checkbox, Divider, Group, SegmentedControl, Stack, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { isValidPhoneNumber } from "libphonenumber-js";
import { ApiError } from "@/lib/authApi";
import { createOrder, type AnswerValue, type Order } from "@/lib/checkoutApi";
import type { PublicEvent } from "@/lib/publicEventApi";
import { EditableQuestionField, isQuestionAnswered } from "@/components/EditableQuestionField";
import { PhoneInput } from "@/components/PhoneInput";

type CartLine = { product_id: number; ticket_option_id: number | null; product_title: string; quantity: number };

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

  const orderQuestions = event.questions.filter((q) => q.scope === "ORDER").sort((a, b) => a.sort_order - b.sort_order);
  const attendeeQuestions = event.questions
    .filter((q) => q.scope === "ATTENDEE")
    .sort((a, b) => a.sort_order - b.sort_order);

  const mutation = useMutation({
    mutationFn: () =>
      createOrder(event.id, {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        items: cartItems.map((item) => ({ product_id: item.product_id, ticket_option_id: item.ticket_option_id, quantity: item.quantity })),
        order_answers: orderQuestions.map((q) => ({ question_id: q.id, answer: orderAnswers[q.id] ?? "" })),
        notify_attendees: notifyAttendees,
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
    onError: (error: Error) =>
      notifications.show({
        color: "red",
        message: error instanceof ApiError ? error.message : "Something went wrong.",
      }),
  });

  function validate(): string | null {
    if (!firstName.trim() || !lastName.trim()) return "Enter your first and last name.";
    if (!/^\S+@\S+\.\S+$/.test(email)) return "Enter a valid email address.";
    if (!phone.trim() || !isValidPhoneNumber(phone)) return "Enter a valid phone number.";

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
        <TextInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
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

      <Group justify="space-between">
        <Button variant="subtle" onClick={onBack} disabled={mutation.isPending}>
          Back to tickets
        </Button>
        <Button onClick={handleSubmit} loading={mutation.isPending}>
          {totalDue === 0 ? "Register for free" : "Continue"}
        </Button>
      </Group>
    </Stack>
  );
}
