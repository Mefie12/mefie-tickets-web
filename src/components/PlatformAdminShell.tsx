"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  AppShell,
  Alert,
  Avatar,
  Badge,
  Group,
  Menu,
  NavLink,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  IconChevronDown,
  IconClipboardList,
  IconLayoutDashboard,
  IconLogout,
  IconShieldLock,
  IconUserShield,
  IconUsers,
  IconBuildingStore,
  IconCategory,
  IconStar,
  IconDevices,
  IconFileText,
} from "@tabler/icons-react";
import { endAdminSession, type AdminDeviceSession } from "@/lib/adminAuthApi";
import { logout } from "@/lib/authApi";
import type { CurrentUser, PlatformRole } from "@/lib/authApi";
import { ThemeToggle } from "@/components/ThemeToggle";

const ROLE_LABEL: Record<PlatformRole, string> = {
  PLATFORM_SUPER_ADMIN: "Super Admin",
  PLATFORM_OPERATIONS: "Operations",
  PLATFORM_FINANCE: "Finance",
  PLATFORM_SUPPORT: "Support",
};

/**
 * The Platform Console's own shell — deliberately distinct branding
 * (dark header, shield mark) from AdminShell (the organization portal)
 * so staff can never mistake which console they're in. Nav items are
 * filtered by the permissions ShowAdminSessionAction returned for the
 * live privileged session, computed fresh server-side on every page
 * load — see decision #15, nothing here is cached beyond the request.
 */
export function PlatformAdminShell({
  user,
  role,
  permissions,
  children,
  session,
}: {
  user: CurrentUser;
  role: PlatformRole;
  permissions: string[];
  children: React.ReactNode;
  session?: AdminDeviceSession;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [now, setNow] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const minutesLeft = session && now > 0 ? Math.max(0, Math.ceil((Math.min(new Date(session.expires_at).getTime(), new Date(session.idle_expires_at).getTime()) - now) / 60_000)) : null;

  const stepDownMutation = useMutation({
    mutationFn: endAdminSession,
    onSuccess: () => router.push("/admin/login"),
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => router.push("/admin/login"),
  });

  const has = (permission: string) => permissions.includes(permission);

  return (
    <AppShell header={{ height: 60 }} navbar={{ width: 240, breakpoint: "sm" }} padding="md">
      <AppShell.Header style={{ background: "var(--mantine-primary-color-filled)", borderColor: "var(--mantine-primary-color-filled-hover)" }}>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <IconShieldLock size={20} color="var(--mantine-color-yellow-5)" />
            <Text fw={700} c="white">
              Mefie Admin Console
            </Text>
            <Badge color="yellow" variant="light" size="sm">
              {ROLE_LABEL[role]}
            </Badge>
          </Group>

          <Group gap="sm" wrap="nowrap">
          <ThemeToggle color="white" />
          <Menu shadow="md" width={220} position="bottom-end">
            <Menu.Target>
              <UnstyledButton>
                <Group gap="xs">
                  <Avatar radius="xl" size="sm" color="yellow">
                    {user.first_name[0]}
                    {user.last_name[0]}
                  </Avatar>
                  <Text size="sm" c="white">
                    {user.first_name} {user.last_name}
                  </Text>
                  <IconChevronDown size={14} color="white" />
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item component={Link} href="/admin/security" leftSection={<IconDevices size={16} />}>Security sessions</Menu.Item>
              <Menu.Item
                leftSection={<IconShieldLock size={16} />}
                onClick={() => stepDownMutation.mutate()}
              >
                Step down from console
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
        <NavLink
          component={Link}
          href="/admin/dashboard"
          label="Dashboard"
          leftSection={<IconLayoutDashboard size={16} />}
          active={pathname === "/admin/dashboard"}
        />
        <NavLink component={Link} href="/admin/security" label="Security sessions" leftSection={<IconDevices size={16} />} active={pathname.startsWith("/admin/security")} />
        {has("organizations.view") && (
          <NavLink
            component={Link}
            href="/admin/organizations"
            label="Organizations"
            leftSection={<IconBuildingStore size={16} />}
            active={pathname.startsWith("/admin/organizations")}
          />
        )}
        {has("users.view") && (
          <NavLink
            component={Link}
            href="/admin/users"
            label="Users"
            leftSection={<IconUsers size={16} />}
            active={pathname.startsWith("/admin/users")}
          />
        )}
        {has("admin_users.view") && (
          <NavLink
            component={Link}
            href="/admin/admin-users"
            label="Admin Users"
            leftSection={<IconUserShield size={16} />}
            active={pathname.startsWith("/admin/admin-users")}
          />
        )}
        {has("audit_log.view") && (
          <NavLink
            component={Link}
            href="/admin/audit-log"
            label="Audit Log"
            leftSection={<IconClipboardList size={16} />}
            active={pathname.startsWith("/admin/audit-log")}
          />
        )}
        {has("event_taxonomy.view") && (
          <NavLink component={Link} href="/admin/event-taxonomy" label="Event Taxonomy" leftSection={<IconCategory size={16} />} active={pathname.startsWith("/admin/event-taxonomy")} />
        )}
        {has("featured_events.view") && (
          <NavLink component={Link} href="/admin/featured-events" label="Featured Events" leftSection={<IconStar size={16} />} active={pathname.startsWith("/admin/featured-events")} />
        )}
        {has("platform_legal_documents.view") && (
          <NavLink component={Link} href="/admin/platform-documents" label="Legal Documents" leftSection={<IconFileText size={16} />} active={pathname.startsWith("/admin/platform-documents")} />
        )}
      </AppShell.Navbar>

      <AppShell.Main>{minutesLeft !== null && minutesLeft <= 5 && <Alert color="yellow" mb="md">Your privileged admin session will end in about {minutesLeft} minute{minutesLeft === 1 ? "" : "s"}. Save your work.</Alert>}{children}</AppShell.Main>
    </AppShell>
  );
}
