"use client";

import Link from "next/link";
import { AppShell, Avatar, Group, Menu, Text, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconLogout, IconShieldLock, IconUserCircle } from "@tabler/icons-react";
import type { SessionUser } from "@/lib/session";
import { usePrivacyConsent } from "@/components/privacy/PrivacyConsentProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MefieLogo } from "@/components/MefieLogo";
import { useSignOut } from "@/lib/useSignOut";
import { useRecheckOnRestore } from "@/lib/useRecheckOnRestore";
import { useLeaveGuard } from "@/lib/leaveGuard";

/**
 * Minimal shell for distributor-only accounts (no organization
 * membership) — mirrors AdminShell's header, but with no sidebar or
 * org-scoped nav, since a distributor only ever needs their allocations
 * and their own account settings.
 */
export function DistributorShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const { openPreferences } = usePrivacyConsent();

  const { signOut } = useSignOut();
  useRecheckOnRestore("organizer");
  useLeaveGuard();

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <MefieLogo h={22} />

          <Group gap="sm" wrap="nowrap">
          <ThemeToggle />
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
              <Menu.Item leftSection={<IconShieldLock size={16} />} onClick={openPreferences}>
                Privacy choices
              </Menu.Item>
              <Menu.Item
                color="red"
                leftSection={<IconLogout size={16} />}
                onClick={() => void signOut("organizer", { redirectTo: "/organizers/login" })}
              >
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
