"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  AppShell,
  Avatar,
  Group,
  Menu,
  NavLink,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  IconBuildingStore,
  IconCalendarEvent,
  IconChevronDown,
  IconLayoutDashboard,
  IconLogout,
  IconTicket,
  IconUserCircle,
  IconUsers,
  IconCreditCard,
} from "@tabler/icons-react";
import { logout } from "@/lib/authApi";
import type { SessionUser } from "@/lib/session";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * The organization admin portal shell (nav + auth guard) called for by
 * 09_mvp_development_plan.md Milestone 3a, filled in once the
 * Organization/Events/Team milestones landed (previously deliberately
 * minimal — see git history).
 */
export function AdminShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => router.push("/login"),
  });

  return (
    <AppShell header={{ height: 60 }} navbar={{ width: 240, breakpoint: "sm" }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <IconTicket size={20} />
            <Text fw={700}>Mefie Tickets</Text>
          </Group>

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
              <Menu.Item component={Link} href="/settings" leftSection={<IconUserCircle size={16} />}>
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
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        {user.role === "ADMIN" && (
          <NavLink
            component={Link}
            href="/organization/payments"
            label="Payments & Payouts"
            leftSection={<IconCreditCard size={16} />}
            active={pathname.startsWith("/organization/payments")}
          />
        )}
        <NavLink
          component={Link}
          href="/dashboard"
          label="Dashboard"
          leftSection={<IconLayoutDashboard size={16} />}
          active={pathname === "/dashboard"}
        />
        <NavLink
          component={Link}
          href="/events"
          label="Events"
          leftSection={<IconCalendarEvent size={16} />}
          active={pathname.startsWith("/events")}
        />
        <NavLink
          component={Link}
          href="/organization"
          label="Organization"
          leftSection={<IconBuildingStore size={16} />}
          active={pathname === "/organization"}
        />
        <NavLink
          component={Link}
          href="/organization/team"
          label="Team"
          leftSection={<IconUsers size={16} />}
          active={pathname.startsWith("/organization/team")}
        />
        <NavLink
          component={Link}
          href="/settings"
          label="Account Settings"
          leftSection={<IconUserCircle size={16} />}
          active={pathname === "/settings"}
        />
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
