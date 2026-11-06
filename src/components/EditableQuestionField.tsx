"use client";

import { Checkbox, Group, Radio, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { CountrySelector } from "@/components/CountrySelector";
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
  error,
  addressErrors,
}: {
  question: PublicQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  error?: string;
  /** ADDRESS only: per-part errors rendered under the matching input. */
  addressErrors?: Partial<Record<keyof AddressAnswer, string>>;
}) {
  const label = question.is_required ? `${question.title} *` : question.title;
  const description = question.description ?? undefined;

  switch (question.type) {
    case "TEXT":
      return (
        <TextInput
          label={label}
          description={description}
          error={error}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
      );

    case "PARAGRAPH":
      return (
        <Textarea
          label={label}
          description={description}
          error={error}
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
          error={error}
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
          error={error}
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
          error={error}
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
          {error && !addressErrors && (
            <Text size="xs" c="red">
              {error}
            </Text>
          )}
          <Group grow>
            <TextInput
              placeholder="Address line"
              error={addressErrors?.address_line1}
              value={address.address_line1}
              onChange={(e) => setField("address_line1", e.currentTarget.value)}
            />
            <TextInput placeholder="City" error={addressErrors?.city} value={address.city} onChange={(e) => setField("city", e.currentTarget.value)} />
          </Group>
          <Group grow>
            <TextInput
              placeholder="State / region"
              error={addressErrors?.state}
              value={address.state}
              onChange={(e) => setField("state", e.currentTarget.value)}
            />
            <TextInput
              placeholder="Postal code"
              error={addressErrors?.postal_code}
              value={address.postal_code}
              onChange={(e) => setField("postal_code", e.currentTarget.value)}
            />
            <CountrySelector
              placeholder="Country"
              aria-label="Country"
              error={addressErrors?.country}
              value={address.country || null}
              onChange={(v) => setField("country", v ?? "")}
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
          error={error}
          checked={(value as boolean) ?? false}
          onChange={(e) => onChange(e.currentTarget.checked)}
        />
      );

    default:
      return null;
  }
}

/**
 * Whether a question's current value counts as "answered" — mirrors OrderService::assertAnswered server-side.
 * `strictAddress` (claim flow) additionally requires address_line1 + city + country for a required ADDRESS, and
 * for an optional ADDRESS that is partly filled; default behaviour is unchanged.
 */
export function isQuestionAnswered(
  question: PublicQuestion,
  value: AnswerValue | undefined,
  options: { strictAddress?: boolean } = {},
): boolean {
  const strictAddress = options.strictAddress ?? false;
  if (!question.is_required && !(strictAddress && question.type === "ADDRESS")) return true;

  switch (question.type) {
    case "AGREEMENT":
      return value === true;
    case "MULTI_SELECT":
      return Array.isArray(value) && value.length > 0;
    case "ADDRESS": {
      const isObject = typeof value === "object" && value !== null && !Array.isArray(value);
      const parts = isObject ? (value as AddressAnswer) : null;
      if (!strictAddress) return !!parts && Object.values(parts).some((v) => v.trim().length > 0);
      const filled = (v: string | undefined) => (v ?? "").trim().length > 0;
      const blank = !parts || Object.values(parts).every((v) => !filled(v));
      if (!question.is_required && blank) return true;
      return !!parts && filled(parts.address_line1) && filled(parts.city) && filled(parts.country);
    }
    default:
      return typeof value === "string" && value.trim().length > 0;
  }
}
