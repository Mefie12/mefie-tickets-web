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
  IconChevronDown,
  IconLogout,
  IconTicket,
  IconUserCircle,
} from "@tabler/icons-react";
import { type CurrentUser, logout } from "@/lib/authApi";

/**
 * The organizer admin portal shell (nav + auth guard) called for by
 * 09_mvp_development_plan.md Milestone 3a. Deliberately minimal — just
 * enough nav to move between organizer management and account settings.
 * Event/product/order nav sections land with the milestones that
 * actually build those screens, not provisioned ahead of need here.
 */
export function AdminShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
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
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <NavLink
          component={Link}
          href="/organizers"
          label="Organizers"
          leftSection={<IconBuildingStore size={16} />}
          active={pathname.startsWith("/organizers")}
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
