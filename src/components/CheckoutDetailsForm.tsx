"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, Card, Divider, Group, Stack, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { createOrder, type AnswerValue, type Order } from "@/lib/checkoutApi";
import type { PublicEvent } from "@/lib/publicEventApi";
import { EditableQuestionField, isQuestionAnswered } from "@/components/EditableQuestionField";

type CartLine = { product_id: number; product_title: string; quantity: number };

type AttendeeSlot = {
  product_id: number;
  product_title: string;
  first_name: string;
  last_name: string;
  email: string;
  answers: Record<number, AnswerValue>;
};

function buildAttendeeSlots(cartItems: CartLine[]): AttendeeSlot[] {
  return cartItems.flatMap((item) =>
    Array.from({ length: item.quantity }, () => ({
      product_id: item.product_id,
      product_title: item.product_title,
      first_name: "",
      last_name: "",
      email: "",
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
 */
export function CheckoutDetailsForm({
  event,
  cartItems,
  onOrderCreated,
  onBack,
}: {
  event: PublicEvent;
  cartItems: CartLine[];
  onOrderCreated: (order: Order) => void;
  onBack: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [orderAnswers, setOrderAnswers] = useState<Record<number, AnswerValue>>({});
  const [attendees, setAttendees] = useState<AttendeeSlot[]>(() => buildAttendeeSlots(cartItems));

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
        items: cartItems.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
        order_answers: orderQuestions.map((q) => ({ question_id: q.id, answer: orderAnswers[q.id] ?? "" })),
        attendees: attendees.map((a) => ({
          product_id: a.product_id,
          first_name: a.first_name,
          last_name: a.last_name,
          email: a.email,
          answers: attendeeQuestions.map((q) => ({ question_id: q.id, answer: a.answers[q.id] ?? "" })),
        })),
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

    for (const q of orderQuestions) {
      if (!isQuestionAnswered(q, orderAnswers[q.id])) return `'${q.title}' is required.`;
    }

    for (const a of attendees) {
      if (!a.first_name.trim() || !a.last_name.trim()) return `Enter a name for each ${a.product_title} attendee.`;
      if (!/^\S+@\S+\.\S+$/.test(a.email)) return `Enter a valid email for each ${a.product_title} attendee.`;
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
        {attendees.map((attendee, index) => (
          <Card key={index} withBorder radius="lg" p="md">
            <Stack gap="sm">
              <Text fw={600} size="sm">
                Attendee {index + 1} — {attendee.product_title}
              </Text>
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
                label="Email"
                size="sm"
                type="email"
                value={attendee.email}
                onChange={(e) => updateAttendee(index, { email: e.currentTarget.value })}
              />
              {attendeeQuestions.map((q) => (
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
        ))}
      </Stack>

      <Group justify="space-between">
        <Button variant="subtle" onClick={onBack} disabled={mutation.isPending}>
          Back to tickets
        </Button>
        <Button onClick={handleSubmit} loading={mutation.isPending}>
          Continue
        </Button>
      </Group>
    </Stack>
  );
}
