"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ActionIcon, AppShell, Badge, Group, Text } from "@mantine/core";
import { IconLogout, IconScan } from "@tabler/icons-react";
import { endGateSession, type GateSessionInfo } from "@/lib/gateApi";
import { clearGateSession } from "@/lib/gateSession";

/**
 * Minimal full-bleed shell for the gate device app (`/gate`). Large
 * touch targets, no distracting chrome — this runs on a volunteer's
 * phone at a door. "End session" revokes the `mefie_gate_session`.
 */
export function GateShell({ session, children }: { session: GateSessionInfo; children: React.ReactNode }) {
  const router = useRouter();

  const end = useMutation({
    mutationFn: endGateSession,
    onSettled: () => {
      clearGateSession();
      router.replace("/gate");
    },
  });

  return (
    <AppShell header={{ height: 56 }} padding={0}>
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
            <IconScan size={20} />
            <Text fw={700} truncate>
              {session.event.title ?? "Gate"}
            </Text>
            <Badge size="sm" variant="light" color={session.role === "SUPERVISOR" ? "grape" : "gray"}>
              {session.role}
            </Badge>
          </Group>
          <ActionIcon
            variant="subtle"
            color="red"
            size="lg"
            aria-label="End gate session"
            onClick={() => end.mutate()}
            loading={end.isPending}
          >
            <IconLogout size={20} />
          </ActionIcon>
        </Group>
      </AppShell.Header>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
