"use client";

import Link from "next/link";
import { Button, Menu, Text, type ButtonProps } from "@mantine/core";
import { IconCalendarEvent, IconChevronDown, IconPlus, IconRepeat } from "@tabler/icons-react";

/**
 * "Create event" now asks up front: a standalone event or a recurring
 * series. These are genuinely different creation flows and backend
 * models (see docs/13_recurring_events_prd.md) — a series owns a
 * template plus independently-operable occurrences, not a single event
 * row — so this routes to the two existing separate wizards
 * (/events/new, /events/new/recurring) rather than trying to unify
 * them. Importing `Link` directly here (not via LinkButton) is safe:
 * the Next 16 Server->Client Link-as-prop issue LinkButton's docblock
 * describes only applies when Link crosses that boundary as a prop —
 * this component is already "use client" and uses Link internally.
 */
export function CreateEventMenu({ label = "Create event", ...buttonProps }: { label?: string } & ButtonProps) {
  return (
    <Menu position="bottom-end" shadow="md" width={270} radius="md" offset={6}>
      <Menu.Target>
        <Button leftSection={<IconPlus size={16} />} rightSection={<IconChevronDown size={14} />} {...buttonProps}>
          {label}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item component={Link} href="/events/new" leftSection={<IconCalendarEvent size={18} />} py={8}>
          <Text size="sm" fw={600}>
            Single event
          </Text>
          <Text size="xs" c="dimmed">
            One date and time
          </Text>
        </Menu.Item>
        <Menu.Item component={Link} href="/events/new/recurring" leftSection={<IconRepeat size={18} />} py={8}>
          <Text size="sm" fw={600}>
            Recurring event
          </Text>
          <Text size="xs" c="dimmed">
            Repeats on a schedule you set
          </Text>
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
