"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ActionIcon, Badge, Box, Button, Drawer, Flex, Group, Stack, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconArrowLeft, IconMenu2 } from "@tabler/icons-react";
import { EventOperationsNav } from "@/components/EventOperationsNav";
import type { EventStatus } from "@/lib/eventApi";
import classes from "./eventOperationsNav.module.css";

const STATUS_COLOR: Record<EventStatus, string> = { LIVE: "teal", DRAFT: "gray", ARCHIVED: "dark" };

/**
 * Layout wrapper for every event-scoped page: the sticky sub-nav column on
 * desktop (>= md), and on mobile a "Menu" trigger that opens the same
 * sub-nav as a right-anchored drawer (BMN settings pattern).
 */
export function EventOperationsNavShell({
  eventId,
  title,
  status,
  children,
}: {
  eventId: number;
  title: string;
  status: EventStatus;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [opened, { open, close }] = useDisclosure(false);

  // Picking a destination in the drawer navigates — close it behind them.
  useEffect(() => {
    close();
  }, [pathname, close]);

  const heading = (
    <Stack gap="xs">
      <Button
        component="a"
        href="/events"
        variant="subtle"
        size="compact-sm"
        leftSection={<IconArrowLeft size={14} />}
        style={{ alignSelf: "flex-start" }}
      >
        Back to events
      </Button>
      <Title order={3} fz={22} lineClamp={2}>
        {title}
      </Title>
      <Badge color={STATUS_COLOR[status]} style={{ alignSelf: "flex-start" }}>
        {status}
      </Badge>
    </Stack>
  );

  return (
    <>
      {/* Mobile: sticky bar with the drawer trigger. */}
      <Group className={classes.mobileBar} hiddenFrom="md" justify="space-between" wrap="nowrap" gap="sm">
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          <ActionIcon
            component="a"
            href="/events"
            variant="subtle"
            color="gray"
            size="lg"
            radius="xl"
            aria-label="Back to events"
            style={{ flexShrink: 0 }}
          >
            <IconArrowLeft size={18} />
          </ActionIcon>
          <Title order={4} fz="md" lineClamp={1}>
            {title}
          </Title>
        </Group>
        <Button
          variant="default"
          size="sm"
          radius="xl"
          onClick={open}
          rightSection={<IconMenu2 size={16} />}
          style={{ flexShrink: 0 }}
        >
          Menu
        </Button>
      </Group>

      <Drawer
        opened={opened}
        onClose={close}
        position="right"
        size={320}
        title={
          <Title order={4} fz="md">
            {title}
          </Title>
        }
        hiddenFrom="md"
      >
        <Stack gap="lg">
          <Badge color={STATUS_COLOR[status]} style={{ alignSelf: "flex-start" }}>
            {status}
          </Badge>
          <EventOperationsNav eventId={eventId} />
        </Stack>
      </Drawer>

      <Flex gap="xl" align="flex-start" direction={{ base: "column", md: "row" }}>
        <Stack className={classes.column} gap="lg" visibleFrom="md">
          {heading}
          <EventOperationsNav eventId={eventId} />
        </Stack>
        <Box className={classes.content}>{children}</Box>
      </Flex>
    </>
  );
}
