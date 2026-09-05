"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { AppShell, Avatar, Container, Group, Menu, Text, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconLogout, IconLogout2, IconTicket } from "@tabler/icons-react";
import { portalLogout, portalLogoutAll } from "@/lib/portalApi";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Shell for the consumer ticket portal (`/tickets`). Deliberately its
 * own surface — no organizer/distributor nav, no shared auth (docs/17
 * §15). The session is `mefie_consumer_session`, isolated from Sanctum.
 */
export function ConsumerPortalShell({
  profile,
  children,
}: {
  profile: { first_name: string; last_name: string; email: string };
  children: React.ReactNode;
}) {
  const router = useRouter();

  const logout = useMutation({
    mutationFn: portalLogout,
    onSuccess: () => router.push("/login"),
  });
  const logoutAll = useMutation({
    mutationFn: portalLogoutAll,
    onSuccess: () => router.push("/login"),
  });

  const initials = `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}`.toUpperCase();

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <IconTicket size={20} />
            <Text fw={700}>My tickets</Text>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <ThemeToggle />
            <Menu shadow="md" width={220} position="bottom-end">
              <Menu.Target>
                <UnstyledButton aria-label="Account menu">
                  <Group gap="xs">
                    <Avatar radius="xl" size="sm" color="brand">
                      {initials}
                    </Avatar>
                    <Text size="sm" visibleFrom="xs">
                      {profile.first_name}
                    </Text>
                    <IconChevronDown size={14} />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{profile.email}</Menu.Label>
                <Menu.Item
                  leftSection={<IconLogout size={16} />}
                  onClick={() => logout.mutate()}
                  disabled={logout.isPending}
                >
                  Sign out
                </Menu.Item>
                <Menu.Item
                  color="red"
                  leftSection={<IconLogout2 size={16} />}
                  onClick={() => logoutAll.mutate()}
                  disabled={logoutAll.isPending}
                >
                  Sign out everywhere
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="sm" px={0}>
          {children}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
