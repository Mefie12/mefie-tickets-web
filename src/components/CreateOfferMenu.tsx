"use client";

import Link from "next/link";
import { Button, Menu, Text } from "@mantine/core";
import { IconBolt, IconChevronDown, IconPercentage, IconPlus, IconTicket } from "@tabler/icons-react";

/**
 * "Create offer" asks what kind of offer up front, like CreateEventMenu does for
 * events. Each choice opens the same form pre-set with that template (?template=),
 * so the organizer lands on a form that already matches what they picked.
 */
export function CreateOfferMenu({ eventId }: { eventId: number }) {
  const base = `/events/${eventId}/offers/new`;
  return (
    <Menu position="bottom-end" shadow="md" width={290} radius="md" offset={6}>
      <Menu.Target>
        <Button leftSection={<IconPlus size={16} />} rightSection={<IconChevronDown size={14} />}>Create offer</Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item component={Link} href={`${base}?template=percent`} leftSection={<IconPercentage size={18} />} py={8}>
          <Text size="sm" fw={600}>Percentage code</Text>
          <Text size="xs" c="dimmed">e.g. SUMMER20 for 20% off</Text>
        </Menu.Item>
        <Menu.Item component={Link} href={`${base}?template=fixed`} leftSection={<IconTicket size={18} />} py={8}>
          <Text size="sm" fw={600}>Fixed-amount code</Text>
          <Text size="xs" c="dimmed">e.g. 10 off each ticket</Text>
        </Menu.Item>
        <Menu.Item component={Link} href={`${base}?template=automatic`} leftSection={<IconBolt size={18} />} py={8}>
          <Text size="sm" fw={600}>Automatic sale</Text>
          <Text size="xs" c="dimmed">Applies without a code</Text>
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
