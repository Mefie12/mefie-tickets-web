"use client";

import { AppShell, Avatar, Container, Group, Menu, Text, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconLogout, IconLogout2, IconShieldLock } from "@tabler/icons-react";
import { usePrivacyConsent } from "@/components/privacy/PrivacyConsentProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MefieLogo } from "@/components/MefieLogo";
import { useSignOut } from "@/lib/useSignOut";
import { useRecheckOnRestore } from "@/lib/useRecheckOnRestore";

/**
 * Shell for the consumer ticket portal (`/tickets`). Deliberately its
 * own surface — no organizer/distributor nav, no shared auth (docs/17
 * §15). The session is `mefie_consumer_session`, isolated from Sanctum.
 */
export function ConsumerPortalShell({
  profile,
  children,
}: {
  profile: { first_name: string | null; last_name: string | null; email: string };
  children: React.ReactNode;
}) {
  const { openPreferences } = usePrivacyConsent();

  const { signOut, pending } = useSignOut();
  useRecheckOnRestore("consumer");

  const initials = `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}`.toUpperCase();

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <MefieLogo h={22} />
            <Text fw={700} c="dimmed">
              My tickets
            </Text>
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
                <Menu.Item leftSection={<IconShieldLock size={16} />} onClick={openPreferences}>
                  Privacy choices
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconLogout size={16} />}
                  onClick={() => void signOut("consumer", { redirectTo: "/login" })}
                  disabled={pending}
                >
                  Sign out
                </Menu.Item>
                <Menu.Item
                  color="red"
                  leftSection={<IconLogout2 size={16} />}
                  onClick={() => void signOut("consumer-all", { redirectTo: "/login" })}
                  disabled={pending}
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
