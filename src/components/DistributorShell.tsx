"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { AppShell, Avatar, Group, Menu, Text, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconLogout, IconTicket, IconUserCircle } from "@tabler/icons-react";
import { logout } from "@/lib/authApi";
import type { SessionUser } from "@/lib/session";

/**
 * Minimal shell for distributor-only accounts (no organization
 * membership) — mirrors AdminShell's header, but with no sidebar or
 * org-scoped nav, since a distributor only ever needs their allocations
 * and their own account settings.
 */
export function DistributorShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const router = useRouter();

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => router.push("/login"),
  });

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <IconTicket size={20} />
            <Text fw={700}>Mefie Tickets</Text>
          </Group>

          <Menu shadow="md" width={200} position="bottom-end">
            <Menu.Target>
              <UnstyledButton>
                <Group gap="xs">
                  <Avatar radius="xl" size="sm" color="brand">
                    {user.first_name[0]}
                    {user.last_name[0]}
                  </Avatar>
                  <Text size="sm">
                    {user.first_name} {user.last_name}
                  </Text>
                  <IconChevronDown size={14} />
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item component={Link} href="/distributor/settings" leftSection={<IconUserCircle size={16} />}>
                Account settings
              </Menu.Item>
              <Menu.Item
                color="red"
                leftSection={<IconLogout size={16} />}
                onClick={() => logoutMutation.mutate()}
              >
                Log out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
