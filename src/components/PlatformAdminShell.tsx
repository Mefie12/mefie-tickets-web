"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Alert, Menu } from "@mantine/core";
import {
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
import { usePrivacyConsent } from "@/components/privacy/PrivacyConsentProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ConsoleNav, ConsoleNavItem, ConsoleNavSection, ConsoleShell } from "@/components/console";

const ROLE_LABEL: Record<PlatformRole, string> = {
  PLATFORM_SUPER_ADMIN: "Super Admin",
  PLATFORM_OPERATIONS: "Operations",
  PLATFORM_FINANCE: "Finance",
  PLATFORM_SUPPORT: "Support",
};

/**
 * The Platform Console's own shell — its privileged identity is carried
 * by the accented brand card at the top of the sidebar (shield mark +
 * role) so staff can never mistake which console they're in. Nav items
 * are filtered by the permissions ShowAdminSessionAction returned for
 * the live privileged session, computed fresh server-side on every page
 * load — see decision #15, nothing here is cached beyond the request.
 *
 * Chrome + responsive sidebar behaviour live in ConsoleShell; this file
 * owns the Platform-specific brand, account menu, permission-gated nav
 * and the privileged-session countdown banner.
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
  const { openPreferences } = usePrivacyConsent();
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

  const nav = (
    <ConsoleNav>
      <ConsoleNavItem
        href="/admin/dashboard"
        label="Dashboard"
        icon={<IconLayoutDashboard size={20} />}
        active={pathname === "/admin/dashboard"}
      />

      <ConsoleNavSection label="Directory">
        {has("organizations.view") && (
          <ConsoleNavItem
            href="/admin/organizations"
            label="Organizations"
            icon={<IconBuildingStore size={20} />}
            active={pathname.startsWith("/admin/organizations")}
          />
        )}
        {has("users.view") && (
          <ConsoleNavItem
            href="/admin/users"
            label="Users"
            icon={<IconUsers size={20} />}
            active={pathname.startsWith("/admin/users")}
          />
        )}
        {has("admin_users.view") && (
          <ConsoleNavItem
            href="/admin/admin-users"
            label="Admin Users"
            icon={<IconUserShield size={20} />}
            active={pathname.startsWith("/admin/admin-users")}
          />
        )}
      </ConsoleNavSection>

      <ConsoleNavSection label="Platform config">
        {has("event_taxonomy.view") && (
          <ConsoleNavItem
            href="/admin/event-taxonomy"
            label="Event Taxonomy"
            icon={<IconCategory size={20} />}
            active={pathname.startsWith("/admin/event-taxonomy")}
          />
        )}
        {has("featured_events.view") && (
          <ConsoleNavItem
            href="/admin/featured-events"
            label="Featured Events"
            icon={<IconStar size={20} />}
            active={pathname.startsWith("/admin/featured-events")}
          />
        )}
        {has("platform_legal_documents.view") && (
          <ConsoleNavItem
            href="/admin/platform-documents"
            label="Legal Documents"
            icon={<IconFileText size={20} />}
            active={pathname.startsWith("/admin/platform-documents")}
          />
        )}
      </ConsoleNavSection>

      <ConsoleNavSection label="Security">
        {has("audit_log.view") && (
          <ConsoleNavItem
            href="/admin/audit-log"
            label="Audit Log"
            icon={<IconClipboardList size={20} />}
            active={pathname.startsWith("/admin/audit-log")}
          />
        )}
        <ConsoleNavItem
          href="/admin/security"
          label="Security sessions"
          icon={<IconDevices size={20} />}
          active={pathname.startsWith("/admin/security")}
        />
      </ConsoleNavSection>
    </ConsoleNav>
  );

  const menuItems = (
    <>
      <Menu.Item component={Link} href="/admin/security" leftSection={<IconDevices size={16} />}>
        Security sessions
      </Menu.Item>
      <Menu.Item leftSection={<IconShieldLock size={16} />} onClick={openPreferences}>
        Privacy choices
      </Menu.Item>
      <Menu.Item leftSection={<IconShieldLock size={16} />} onClick={() => stepDownMutation.mutate()}>
        Step down from console
      </Menu.Item>
      <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={() => logoutMutation.mutate()}>
        Log out
      </Menu.Item>
    </>
  );

  const banner =
    minutesLeft !== null && minutesLeft <= 5 ? (
      <Alert color="yellow" mb="md">
        Your privileged admin session will end in about {minutesLeft} minute{minutesLeft === 1 ? "" : "s"}. Save your work.
      </Alert>
    ) : null;

  return (
    <ConsoleShell
      storageKey="platform-console-nav-collapsed"
      brand={{
        logo: <IconShieldLock size={22} color="var(--mantine-color-yellow-6)" />,
        primary: "Mefie Admin",
        secondary: ROLE_LABEL[role],
        accent: true,
      }}
      account={{
        initials: `${user.first_name[0]}${user.last_name[0]}`,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        avatarColor: "yellow",
        menuItems,
      }}
      headerEnd={<ThemeToggle />}
      nav={nav}
      banner={banner}
    >
      {children}
    </ConsoleShell>
  );
}
