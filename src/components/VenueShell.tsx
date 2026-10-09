"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { AppShell, Avatar, Group, Menu, Text, UnstyledButton } from "@mantine/core";
import { IconBuildingStore, IconCalendarEvent, IconChevronDown, IconLogout, IconShieldLock, IconUserCircle } from "@tabler/icons-react";
import { logout } from "@/lib/authApi";
import type { SessionUser } from "@/lib/session";
import { usePrivacyConsent } from "@/components/privacy/PrivacyConsentProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MefieLogo } from "@/components/MefieLogo";

/**
 * Minimal shell for venue agents (docs/25): a header only, like the
 * distributor shell. A venue agent has no organization, so there is no
 * sidebar or organizer navigation to show.
 */
export function VenueShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const router = useRouter();
  const { openPreferences } = usePrivacyConsent();
  const logoutMutation = useMutation({ mutationFn: logout, onSuccess: () => router.push("/organizers/login") });

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="md" wrap="nowrap">
            <MefieLogo h={22} />
            <Text component={Link} href="/venue" size="sm" fw={500} c="dimmed" td="none" visibleFrom="xs">
              Venue events
            </Text>
          </Group>

          <Group gap="sm" wrap="nowrap">
            <ThemeToggle />
            <Menu shadow="md" width={220} position="bottom-end">
              <Menu.Target>
                <UnstyledButton aria-label="Account menu">
                  <Group gap="xs" wrap="nowrap">
                    <Avatar radius="xl" size="sm" color="brand">
                      {user.first_name[0]}
                      {user.last_name[0]}
                    </Avatar>
                    <Text size="sm" visibleFrom="sm">
                      {user.first_name} {user.last_name}
                    </Text>
                    <IconChevronDown size={14} />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item component={Link} href="/venue" leftSection={<IconCalendarEvent size={16} />}>
                  Venue events
                </Menu.Item>
                {user.portal_access.distributor && (
                  <Menu.Item component={Link} href="/distributor" leftSection={<IconBuildingStore size={16} />}>
                    Distributor portal
                  </Menu.Item>
                )}
                <Menu.Item component={Link} href="/venue/settings" leftSection={<IconUserCircle size={16} />}>
                  Account settings
                </Menu.Item>
                <Menu.Item leftSection={<IconShieldLock size={16} />} onClick={openPreferences}>
                  Privacy choices
                </Menu.Item>
                <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={() => logoutMutation.mutate()}>
                  Log out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
