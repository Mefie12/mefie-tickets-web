"use client";

import { useId, type ReactNode } from "react";
import { Badge, Box, Button, Collapse, Group, SimpleGrid, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import { IconAdjustments, IconChevronDown } from "@tabler/icons-react";
import { joinLocalDateTime, splitLocalDateTime, wallClockEndIsInvalid } from "@/lib/eventDateTime";

/** The four wall-clock parts the API takes for a sale window (event timezone). "" = not set. */
export type WindowParts = {
  starts_at_date: string;
  starts_at_time: string;
  ends_at_date: string;
  ends_at_time: string;
};

export const hasSaleWindow = (w: WindowParts) => Boolean(w.starts_at_date || w.ends_at_date);

/** "12 Nov, 18:00" from a wall-clock date + time (no timezone maths — it is already event-local). */
export function formatWallClock(date: string, time: string): string {
  const parsed = new Date(`${date}T${time || "00:00"}`);
  if (Number.isNaN(parsed.getTime())) return `${date} ${time}`.trim();
  return parsed.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** One-line description of a sale window, with what a blank side means. */
export function describeSaleWindow(w: WindowParts): string {
  const from = w.starts_at_date ? `From ${formatWallClock(w.starts_at_date, w.starts_at_time)}` : "On sale immediately";
  const until = w.ends_at_date ? `until ${formatWallClock(w.ends_at_date, w.ends_at_time)}` : "until the event ends";
  return `${from} ${until}`;
}

/**
 * Collapsible "More settings": closed by default so the form stays short,
 * but the closed header says what the current settings are (the defaults,
 * or what was customised) and flags non-default values with a badge.
 * Controlled so a parent can open it when a validation error lands inside.
 */
export function MoreSettings({
  opened,
  onToggle,
  summary,
  customised,
  children,
  label = "More settings",
}: {
  opened: boolean;
  onToggle: () => void;
  summary: string;
  customised: boolean;
  children: ReactNode;
  label?: string;
}) {
  const panelId = useId();
  return (
    // One bordered card: the header button and the settings it reveals live inside the same box,
    // so the settings visibly belong to it (and the whole thing is one tidy block at any width).
    <Box
      style={{
        border: "1px solid var(--mantine-color-default-border)",
        borderRadius: "var(--mantine-radius-md)",
        overflow: "hidden",
      }}
    >
      <UnstyledButton
        type="button"
        onClick={onToggle}
        aria-expanded={opened}
        aria-controls={panelId}
        w="100%"
        py={12}
        px="md"
        style={{ display: "block", background: opened ? "var(--mantine-color-default-hover)" : undefined }}
      >
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
            <IconAdjustments size={16} aria-hidden="true" />
            <Text size="sm" fw={600}>{label}</Text>
            {customised && <Badge size="xs" variant="dot">Customised</Badge>}
          </Group>
          <IconChevronDown
            size={16}
            aria-hidden="true"
            style={{ flexShrink: 0, transition: "transform 150ms", transform: opened ? "rotate(180deg)" : undefined }}
          />
        </Group>
        {!opened && <Text size="xs" c="dimmed" mt={4} lineClamp={2}>{summary}</Text>}
      </UnstyledButton>
      <Collapse in={opened} id={panelId}>
        <Stack
          gap="md"
          p="md"
          style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
        >
          {children}
        </Stack>
      </Collapse>
    </Box>
  );
}

/**
 * Sale window as two date-and-time pickers (like the event's own start/end).
 * The form keeps the API's date + time parts; this joins/splits them for the
 * native `datetime-local` input. Moving the start past the end clears the
 * end, and the end picker can't go earlier than the start.
 */
export function SaleWindowFields({
  value,
  onChange,
  timezone,
  startError,
  endError,
  note,
  idPrefix,
}: {
  value: WindowParts;
  onChange: (next: WindowParts) => void;
  timezone: string;
  startError?: ReactNode;
  endError?: ReactNode;
  /** Extra line under the pickers (e.g. how a group window combines with its options'). */
  note?: string;
  idPrefix: string;
}) {
  const start = joinLocalDateTime({ date: value.starts_at_date, time: value.starts_at_time });
  const end = joinLocalDateTime({ date: value.ends_at_date, time: value.ends_at_time });

  const setStart = (raw: string) => {
    const s = splitLocalDateTime(raw);
    const next: WindowParts = { ...value, starts_at_date: s.date, starts_at_time: s.time };
    if (wallClockEndIsInvalid(s.date, s.time, value.ends_at_date, value.ends_at_time)) {
      next.ends_at_date = "";
      next.ends_at_time = "";
    }
    onChange(next);
  };
  const setEnd = (raw: string) => {
    const e = splitLocalDateTime(raw);
    onChange({ ...value, ends_at_date: e.date, ends_at_time: e.time });
  };

  return (
    <Stack gap="xs">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <TextInput
          id={`${idPrefix}-starts`}
          type="datetime-local"
          label="Sales start"
          description="Leave blank to sell immediately."
          inputWrapperOrder={["label", "input", "description", "error"]}
          value={start}
          onChange={(event) => setStart(event.currentTarget.value)}
          error={startError}
        />
        <TextInput
          id={`${idPrefix}-ends`}
          type="datetime-local"
          label="Sales end"
          description="Leave blank to sell until the event ends."
          inputWrapperOrder={["label", "input", "description", "error"]}
          min={start || undefined}
          value={end}
          onChange={(event) => setEnd(event.currentTarget.value)}
          error={endError}
        />
      </SimpleGrid>
      <Group justify="space-between" gap="xs" align="flex-start">
        <Text size="xs" c="dimmed" style={{ flex: 1, minWidth: 200 }}>
          Times are in {timezone}, this event&apos;s timezone.{note ? ` ${note}` : ""}
        </Text>
        {hasSaleWindow(value) && (
          <Button
            type="button"
            variant="subtle"
            size="compact-xs"
            onClick={() => onChange({ starts_at_date: "", starts_at_time: "", ends_at_date: "", ends_at_time: "" })}
          >
            Clear sale window
          </Button>
        )}
      </Group>
    </Stack>
  );
}
