"use client";

import { Button, Container, Group, Stack, Text, Title } from "@mantine/core";
import { IconTicket, IconTicketOff } from "@tabler/icons-react";
import Link from "next/link";

/**
 * Mirrors AuthLayout's composition (same wordmark row, same
 * typographic scale) so a 404 feels like part of this app rather than
 * a generic framework error page. homeHref/homeLabel let each
 * route-group-scoped not-found.tsx send its audience somewhere
 * actually useful for them, not always "/".
 */
export function NotFoundPage({ homeHref, homeLabel }: { homeHref: string; homeLabel: string }) {
  return (
    <Container size="xs" py={100}>
      <Stack gap="xl" align="center">
        <Group gap="xs" justify="center">
          <IconTicket size={22} />
          <Text size="sm" c="dimmed" fw={500}>
            Mefie Tickets
          </Text>
        </Group>

        <IconTicketOff size={64} stroke={1.5} opacity={0.6} />

        <Stack gap={4} align="center">
          <Title order={1} fz={28} ta="center">
            This page doesn&apos;t exist
          </Title>
          <Text c="dimmed" size="sm" ta="center" maw={380}>
            The link might be broken, or the page may have moved. Let&apos;s get you back on track.
          </Text>
        </Stack>

        <Button component={Link} href={homeHref} size="md">
          {homeLabel}
        </Button>
      </Stack>
    </Container>
  );
}
