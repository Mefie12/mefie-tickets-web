"use client";

import { SimpleGrid, Stack, TextInput } from "@mantine/core";
import type { PublicQuestion } from "@/lib/publicEventApi";
import type { AnswerValue } from "@/lib/checkoutApi";
import type { AttendeeRegistration, RegistrationSchema } from "@/lib/portalApi";
import { EditableQuestionField, isQuestionAnswered } from "@/components/EditableQuestionField";
import { PhoneInput } from "@/components/PhoneInput";

export type AttendeeFormValue = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  answers: Record<number, AnswerValue>;
};

export const emptyAttendeeForm: AttendeeFormValue = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  answers: {},
};

/** Shape the RegistrationSchema question into what EditableQuestionField wants. */
function asPublicQuestion(q: RegistrationSchema["attendee_questions"][number]): PublicQuestion {
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

/** first/last required, email & phone valid-if-present, every required question answered */
export function attendeeFormError(value: AttendeeFormValue, questions: RegistrationSchema["attendee_questions"]): string | null {
  if (!value.first_name.trim() || !value.last_name.trim()) return "Enter a first and last name.";
  if (value.email.trim() && !/^\S+@\S+\.\S+$/.test(value.email)) return "Enter a valid email, or leave it blank.";
  for (const q of questions) {
    if (!isQuestionAnswered(asPublicQuestion(q), value.answers[q.id])) return `'${q.title}' is required.`;
  }
  return null;
}

export function toAttendeeRegistration(
  value: AttendeeFormValue,
  questions: RegistrationSchema["attendee_questions"],
): AttendeeRegistration {
  return {
    first_name: value.first_name.trim(),
    last_name: value.last_name.trim(),
    email: value.email.trim() || null,
    phone: value.phone.trim() || null,
    answers: questions.map((q) => ({ question_id: q.id, answer: value.answers[q.id] ?? "" })),
  };
}

/**
 * The name / contact / event-question fields for one attendee, shared by
 * portal assign, bulk assign, reassign, and (a subset) attendee
 * correction.
 */
export function AttendeeRegistrationFields({
  value,
  onChange,
  questions,
  contactRequired = false,
}: {
  value: AttendeeFormValue;
  onChange: (next: AttendeeFormValue) => void;
  questions: RegistrationSchema["attendee_questions"];
  contactRequired?: boolean;
}) {
  const patch = (p: Partial<AttendeeFormValue>) => onChange({ ...value, ...p });

  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
        <TextInput
          label="First name"
          value={value.first_name}
          onChange={(e) => patch({ first_name: e.currentTarget.value })}
          required
        />
        <TextInput
          label="Last name"
          value={value.last_name}
          onChange={(e) => patch({ last_name: e.currentTarget.value })}
          required
        />
      </SimpleGrid>
      <TextInput
        label={contactRequired ? "Email" : "Email (optional)"}
        description="Where their ticket is sent"
        type="email"
        inputMode="email"
        value={value.email}
        onChange={(e) => patch({ email: e.currentTarget.value })}
        required={contactRequired}
      />
      <PhoneInput
        label="Phone (optional)"
        value={value.phone}
        onChange={(phone) => patch({ phone })}
      />
      {questions.map((q) => (
        <EditableQuestionField
          key={q.id}
          question={asPublicQuestion(q)}
          value={value.answers[q.id]}
          onChange={(answer) => patch({ answers: { ...value.answers, [q.id]: answer } })}
        />
      ))}
    </Stack>
  );
}
