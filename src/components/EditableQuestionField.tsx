"use client";

import { Checkbox, Group, Radio, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import type { PublicQuestion } from "@/lib/publicEventApi";
import type { AddressAnswer, AnswerValue } from "@/lib/checkoutApi";

const emptyAddress: AddressAnswer = { address_line1: "", city: "", state: "", postal_code: "", country: "" };

/**
 * Real, editable version of each question type — Milestone 5's
 * QuestionForm only ever rendered a disabled preview. Shared between
 * order-level and attendee-level rendering in CheckoutDetailsForm.
 */
export function EditableQuestionField({
  question,
  value,
  onChange,
}: {
  question: PublicQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  const label = question.is_required ? `${question.title} *` : question.title;
  const description = question.description ?? undefined;

  switch (question.type) {
    case "TEXT":
      return (
        <TextInput
          label={label}
          description={description}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
      );

    case "PARAGRAPH":
      return (
        <Textarea
          label={label}
          description={description}
          autosize
          minRows={2}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
      );

    case "SINGLE_SELECT":
      return (
        <Select
          label={label}
          description={description}
          placeholder="Choose one"
          data={question.options ?? []}
          value={(value as string) ?? null}
          onChange={(v) => onChange(v ?? "")}
        />
      );

    case "RADIO":
      return (
        <Radio.Group
          label={label}
          description={description}
          value={(value as string) ?? ""}
          onChange={(v) => onChange(v)}
        >
          <Stack gap={4} mt={4}>
            {(question.options ?? []).map((option) => (
              <Radio key={option} value={option} label={option} />
            ))}
          </Stack>
        </Radio.Group>
      );

    case "MULTI_SELECT": {
      const selected = (value as string[]) ?? [];
      return (
        <Checkbox.Group
          label={label}
          description={description}
          value={selected}
          onChange={(v) => onChange(v)}
        >
          <Stack gap={4} mt={4}>
            {(question.options ?? []).map((option) => (
              <Checkbox key={option} value={option} label={option} />
            ))}
          </Stack>
        </Checkbox.Group>
      );
    }

    case "ADDRESS": {
      const address = (value as AddressAnswer) ?? emptyAddress;
      const setField = (field: keyof AddressAnswer, fieldValue: string) =>
        onChange({ ...address, [field]: fieldValue });

      return (
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            {label}
          </Text>
          {description && (
            <Text size="xs" c="dimmed">
              {description}
            </Text>
          )}
          <Group grow>
            <TextInput
              placeholder="Address line"
              value={address.address_line1}
              onChange={(e) => setField("address_line1", e.currentTarget.value)}
            />
            <TextInput placeholder="City" value={address.city} onChange={(e) => setField("city", e.currentTarget.value)} />
          </Group>
          <Group grow>
            <TextInput
              placeholder="State / region"
              value={address.state}
              onChange={(e) => setField("state", e.currentTarget.value)}
            />
            <TextInput
              placeholder="Postal code"
              value={address.postal_code}
              onChange={(e) => setField("postal_code", e.currentTarget.value)}
            />
            <TextInput
              placeholder="Country"
              value={address.country}
              onChange={(e) => setField("country", e.currentTarget.value)}
            />
          </Group>
        </Stack>
      );
    }

    case "AGREEMENT":
      return (
        <Checkbox
          label={label}
          description={description}
          checked={(value as boolean) ?? false}
          onChange={(e) => onChange(e.currentTarget.checked)}
        />
      );

    default:
      return null;
  }
}

/** Whether a required question's current value counts as "answered" — mirrors OrderService::assertAnswered server-side. */
export function isQuestionAnswered(question: PublicQuestion, value: AnswerValue | undefined): boolean {
  if (!question.is_required) return true;

  switch (question.type) {
    case "AGREEMENT":
      return value === true;
    case "MULTI_SELECT":
      return Array.isArray(value) && value.length > 0;
    case "ADDRESS":
      return typeof value === "object" && value !== null && !Array.isArray(value) && Object.values(value).some((v) => v.trim().length > 0);
    default:
      return typeof value === "string" && value.trim().length > 0;
  }
}
