"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconAlertTriangle, IconCircleCheck } from "@tabler/icons-react";
import type { AnswerValue } from "@/lib/checkoutApi";
import type { ClaimPreview } from "@/lib/claimApi";
import { submitClaim } from "@/lib/claimApi";
import { ApiError } from "@/lib/authApi";
import { resolveApiErrorMessageWithReference } from "@/lib/apiErrorMessages";
import {
  emptyClaimFieldErrors,
  firstErrorTarget,
  hasClaimFieldErrors,
  mapClaimFieldErrors,
  type AddressPart,
  type ClaimFieldErrors,
  type ClaimTextField,
} from "@/lib/claimFieldErrors";
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

class LocalValidationError extends Error {
  constructor(public fieldErrors: ClaimFieldErrors) {
    super("Validation failed");
  }
}

export function ClaimForm({ preview }: { preview: ClaimPreview }) {
  const [form, setForm] = useState<AttendeeFormValue>(emptyAttendeeForm);
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ClaimFieldErrors>(emptyClaimFieldErrors);
  const [focusTarget, setFocusTarget] = useState<string | null>(null);

  const questions = preview.attendee_questions;

  const showFieldErrors = (next: ClaimFieldErrors) => {
    setFieldErrors(next);
    setFocusTarget(firstErrorTarget(next, questions.map((q) => q.id)));
  };

  // Focus after the error props have rendered.
  useEffect(() => {
    if (!focusTarget) return;
    const [kind, key] = focusTarget.split(":");
    const root =
      kind === "field"
        ? document.querySelector<HTMLElement>(`[data-claim-field="${key}"]`)
        : document.querySelector<HTMLElement>(`[data-claim-question="${key}"]`);
    root?.scrollIntoView({ block: "center", behavior: "smooth" });
    (root?.matches("input,textarea,select,button") ? root : root?.querySelector<HTMLElement>("input,textarea,select"))?.focus({
      preventScroll: true,
    });
    setFocusTarget(null);
  }, [focusTarget]);

  const clearField = (field: ClaimTextField) =>
    setFieldErrors((prev) => (prev.fields[field] ? { ...prev, fields: { ...prev.fields, [field]: undefined } } : prev));
  const clearQuestion = (id: number) =>
    setFieldErrors((prev) => {
      if (!prev.answers[id] && !prev.addressParts[id]) return prev;
      const { [id]: _a, ...answersRest } = prev.answers;
      const { [id]: _p, ...partsRest } = prev.addressParts;
      void _a;
      void _p;
      return { ...prev, answers: answersRest, addressParts: partsRest };
    });

  const submit = useMutation({
    mutationFn: () => {
      const local = emptyClaimFieldErrors();
      if (!form.first_name.trim()) local.fields.first_name = "Enter your first name.";
      if (!form.last_name.trim()) local.fields.last_name = "Enter your last name.";
      if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email)) {
        local.fields.email = "Enter a valid email, or leave it blank.";
      } else if (!preview.delivery_locked && !form.email.trim()) {
        local.fields.email = "Enter an email so we can send you the ticket.";
      }
      for (const q of questions) {
        if (!isQuestionAnswered(asPublicQuestion(q), answers[q.id], { strictAddress: true })) {
          local.answers[q.id] =
            q.type === "ADDRESS" ? "Enter at least the address line, city and country." : `'${q.title}' is required.`;
        }
      }
      if (hasClaimFieldErrors(local)) {
        return Promise.reject(new LocalValidationError(local));
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
    onError: (e) => {
      if (e instanceof LocalValidationError) {
        setError(null);
        showFieldErrors(e.fieldErrors);
        return;
      }
      const mapped = e instanceof ApiError && e.status === 422 ? mapClaimFieldErrors(e.errors) : emptyClaimFieldErrors();
      if (hasClaimFieldErrors(mapped)) {
        showFieldErrors(mapped);
        setError("Some details need fixing — see the highlighted fields.");
      } else {
        setFieldErrors(emptyClaimFieldErrors());
        setError(resolveApiErrorMessageWithReference(e));
      }
    },
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
              : `We're preparing your ticket and will email it to ${form.email.trim()} shortly. Not there in a few minutes? Check your spam folder${preview.inviter_first_name ? `, or ask ${preview.inviter_first_name}` : ""}.`}
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
        onChange={(next) => {
          for (const f of ["first_name", "last_name", "email", "phone"] as const) if (next[f] !== form[f]) clearField(f);
          setForm(next);
        }}
        errors={fieldErrors.fields}
        emailHint="Where we'll send your ticket"
        questions={[]}
        contactRequired={!preview.delivery_locked}
      />

      {questions.map((q) => (
        <div key={q.id} data-claim-question={q.id}>
          <EditableQuestionField
            question={asPublicQuestion(q)}
            value={answers[q.id]}
            onChange={(v) => {
              clearQuestion(q.id);
              setAnswers((prev) => ({ ...prev, [q.id]: v }));
            }}
            error={fieldErrors.answers[q.id]}
            addressErrors={fieldErrors.addressParts[q.id] as Partial<Record<AddressPart, string>> | undefined}
          />
        </div>
      ))}

      <Button onClick={() => submit.mutate()} loading={submit.isPending} size="md">
        Claim my ticket
      </Button>
    </Stack>
  );
}
