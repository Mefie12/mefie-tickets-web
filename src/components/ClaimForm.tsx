"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconAlertTriangle, IconCircleCheck } from "@tabler/icons-react";
import type { AnswerValue } from "@/lib/checkoutApi";
import type { ClaimPreview } from "@/lib/claimApi";
import { submitClaim } from "@/lib/claimApi";
import { resolveApiErrorMessage } from "@/lib/apiErrorMessages";
import { EditableQuestionField, isQuestionAnswered } from "@/components/EditableQuestionField";
import { AttendeeRegistrationFields, emptyAttendeeForm, type AttendeeFormValue } from "@/components/AttendeeRegistrationFields";
import type { PublicQuestion } from "@/lib/publicEventApi";

function asPublicQuestion(q: ClaimPreview["attendee_questions"][number]): PublicQuestion {
  return {
    id: q.id,
    title: q.title,
    description: q.description,
    scope: "ATTENDEE",
    type: q.type as PublicQuestion["type"],
    options: q.options,
    is_required: q.is_required,
    sort_order: 0,
  };
}

export function ClaimForm({ preview }: { preview: ClaimPreview }) {
  const [form, setForm] = useState<AttendeeFormValue>(emptyAttendeeForm);
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [error, setError] = useState<string | null>(null);

  const questions = preview.attendee_questions;

  const submit = useMutation({
    mutationFn: () => {
      if (!form.first_name.trim() || !form.last_name.trim()) {
        return Promise.reject(new Error("Enter your first and last name."));
      }
      if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email)) {
        return Promise.reject(new Error("Enter a valid email, or leave it blank."));
      }
      if (!preview.delivery_locked && !form.email.trim()) {
        return Promise.reject(new Error("Enter an email so we can send you the ticket."));
      }
      for (const q of questions) {
        if (!isQuestionAnswered(asPublicQuestion(q), answers[q.id])) {
          return Promise.reject(new Error(`'${q.title}' is required.`));
        }
      }
      return submitClaim({
        self: false,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        answers: questions.map((q) => ({ question_id: q.id, answer: answers[q.id] ?? "" })),
      });
    },
    onError: (e) => setError(resolveApiErrorMessage(e)),
  });

  if (submit.isSuccess) {
    return (
      <Stack gap="md" align="center" ta="center">
        <ThemeIcon size={56} radius="xl" color="teal" variant="light">
          <IconCircleCheck size={32} />
        </ThemeIcon>
        <Title order={2} fz={22}>
          You&apos;re in!
        </Title>
        <Text c="dimmed" size="sm">
          {preview.requires_personal_acceptance
            ? "Check your email — you'll get one more link to personally confirm your spot before the ticket becomes valid."
            : preview.delivery_locked
              ? "Your ticket is on its way to the organizer-set address."
              : `We've sent your ticket to ${form.email}.`}
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Title order={2} fz={22}>
          {preview.inviter_first_name
            ? `${preview.inviter_first_name} sent you a ticket`
            : "You've been sent a ticket"}
        </Title>
        <Text c="dimmed" size="sm">
          {preview.event.title}
          {preview.ticket.name ? ` · ${preview.ticket.name}` : ""}
          {preview.ticket.option ? ` (${preview.ticket.option})` : ""}
        </Text>
      </Stack>

      {error && (
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />} withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {preview.delivery_locked && (
        <Alert color="gray" variant="light">
          The organizer set where this ticket is delivered ({preview.masked_delivery_email}). Your email here is just for
          updates.
        </Alert>
      )}

      <AttendeeRegistrationFields
        value={form}
        onChange={setForm}
        questions={[]}
        contactRequired={!preview.delivery_locked}
      />

      {questions.map((q) => (
        <EditableQuestionField
          key={q.id}
          question={asPublicQuestion(q)}
          value={answers[q.id]}
          onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
        />
      ))}

      <Button onClick={() => submit.mutate()} loading={submit.isPending} size="md">
        Claim my ticket
      </Button>
    </Stack>
  );
}
