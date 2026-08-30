"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Button, Loader, Modal, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { AnswerValue } from "@/lib/checkoutApi";
import { correctAttendee, getRegistrationSchema, type EntitlementRow } from "@/lib/portalApi";
import { resolveApiErrorMessage } from "@/lib/apiErrorMessages";
import { EditableQuestionField } from "@/components/EditableQuestionField";
import { PhoneInput } from "@/components/PhoneInput";
import type { PublicQuestion } from "@/lib/publicEventApi";
import { ticketLabel } from "@/lib/portalStatus";

function asPublicQuestion(q: {
  id: number;
  title: string;
  description: string | null;
  type: string;
  options: string[] | null;
  is_required: boolean;
}): PublicQuestion {
  return { id: q.id, title: q.title, description: q.description, scope: "ATTENDEE", type: q.type as PublicQuestion["type"], options: q.options, is_required: q.is_required, sort_order: 0 };
}

/**
 * Fix a typo in an already-issued attendee (docs/17 §2.3) — name /
 * contact / answers. The credential / QR is never rotated, so no
 * step-up. Only changed fields are sent.
 */
export function CorrectAttendeeModal({
  entitlement,
  opened,
  onClose,
  onDone,
}: {
  entitlement: EntitlementRow | null;
  opened: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  // Keyed by public_id in the parent, so this mounts fresh per target —
  // safe to seed straight from props.
  const [firstName, setFirstName] = useState(entitlement?.attendee?.first_name ?? "");
  const [lastName, setLastName] = useState(entitlement?.attendee?.last_name ?? "");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [error, setError] = useState<string | null>(null);

  const schema = useQuery({
    queryKey: ["reg-schema", entitlement?.public_id],
    queryFn: () => getRegistrationSchema(entitlement!.public_id),
    enabled: opened && entitlement !== null,
  });
  const questions = schema.data?.attendee_questions ?? [];

  const submit = useMutation({
    mutationFn: () => {
      const body: Parameters<typeof correctAttendee>[1] = {};
      if (firstName.trim() && firstName.trim() !== entitlement?.attendee?.first_name) body.first_name = firstName.trim();
      if (lastName.trim() && lastName.trim() !== entitlement?.attendee?.last_name) body.last_name = lastName.trim();
      if (email.trim()) {
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) return Promise.reject(new Error("Enter a valid email."));
        body.email = email.trim();
      }
      if (phone.trim()) body.phone = phone.trim();
      const changedAnswers = questions
        .filter((q) => answers[q.id] !== undefined && answers[q.id] !== "")
        .map((q) => ({ question_id: q.id, answer: answers[q.id] }));
      if (changedAnswers.length) body.answers = changedAnswers as { question_id: number; answer: AnswerValue }[];

      if (Object.keys(body).length === 0) return Promise.reject(new Error("Change at least one field."));
      return correctAttendee(entitlement!.public_id, body);
    },
    onSuccess: () => {
      notifications.show({ color: "teal", message: "Attendee details updated." });
      onDone();
      onClose();
    },
    onError: (e) => setError(resolveApiErrorMessage(e)),
  });

  return (
    <Modal
      opened={opened}
      onClose={() => !submit.isPending && onClose()}
      title="Edit attendee details"
      centered
    >
      <Stack gap="md">
        {entitlement && (
          <Text size="sm" c="dimmed">
            {ticketLabel(entitlement.ticket)} #{entitlement.sequence_number} — fix a typo without issuing a new ticket.
          </Text>
        )}
        {error && (
          <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          <TextInput label="First name" value={firstName} onChange={(e) => setFirstName(e.currentTarget.value)} />
          <TextInput label="Last name" value={lastName} onChange={(e) => setLastName(e.currentTarget.value)} />
        </SimpleGrid>
        <TextInput
          label="New email (optional)"
          description="Leave blank to keep the current one"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
        />
        <PhoneInput label="New phone (optional)" value={phone} onChange={setPhone} />

        {schema.isLoading && <Loader size="sm" />}
        {questions.map((q) => (
          <EditableQuestionField
            key={q.id}
            question={asPublicQuestion(q)}
            value={answers[q.id]}
            onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
          />
        ))}

        <Button onClick={() => submit.mutate()} loading={submit.isPending}>
          Save changes
        </Button>
      </Stack>
    </Modal>
  );
}
