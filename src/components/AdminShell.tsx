"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Avatar, Menu } from "@mantine/core";
import {
  IconBuildingStore,
  IconCalendarEvent,
  IconLayoutDashboard,
  IconLogout,
  IconShieldLock,
  IconTicket,
  IconUserCircle,
  IconUsers,
  IconCreditCard,
} from "@tabler/icons-react";
import { logout } from "@/lib/authApi";
import type { NavOrganization, SessionUser } from "@/lib/session";
import { usePrivacyConsent } from "@/components/privacy/PrivacyConsentProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ConsoleNav, ConsoleNavItem, ConsoleNavSection, ConsoleShell } from "@/components/console";

/**
 * The organization admin portal shell (nav + auth guard) called for by
 * 09_mvp_development_plan.md Milestone 3a. Chrome + responsive sidebar
 * behaviour live in ConsoleShell; this file owns the organizer-portal
 * brand card (the current org's logo + name), account menu and nav.
 */
export function AdminShell({
  user,
  organization,
  children,
}: {
  user: SessionUser;
  organization: NavOrganization | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { openPreferences } = usePrivacyConsent();

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => router.push("/organizers/login"),
  });

  const nav = (
    <ConsoleNav>
      <ConsoleNavItem
        href="/dashboard"
        label="Dashboard"
        icon={<IconLayoutDashboard size={20} />}
        active={pathname === "/dashboard"}
      />
      <ConsoleNavItem
        href="/events"
        label="Events"
        icon={<IconCalendarEvent size={20} />}
        active={pathname.startsWith("/events")}
      />
      {user.role === "ADMIN" && (
        <ConsoleNavItem
          href="/organization/payments"
          label="Payments & Payouts"
          icon={<IconCreditCard size={20} />}
          active={pathname.startsWith("/organization/payments")}
        />
      )}

      <ConsoleNavSection label="Organization">
        <ConsoleNavItem
          href="/organization"
          label="Organization"
          icon={<IconBuildingStore size={20} />}
          active={pathname === "/organization"}
        />
        <ConsoleNavItem
          href="/organization/team"
          label="Team"
          icon={<IconUsers size={20} />}
          active={pathname.startsWith("/organization/team")}
        />
      </ConsoleNavSection>

      <ConsoleNavSection label="Account">
        <ConsoleNavItem
          href="/settings"
          label="Account Settings"
          icon={<IconUserCircle size={20} />}
          active={pathname === "/settings"}
        />
      </ConsoleNavSection>
    </ConsoleNav>
  );

  const menuItems = (
    <>
      <Menu.Item component={Link} href="/settings" leftSection={<IconUserCircle size={16} />}>
        Account settings
      </Menu.Item>
      <Menu.Item leftSection={<IconShieldLock size={16} />} onClick={openPreferences}>
        Privacy choices
      </Menu.Item>
      <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={() => logoutMutation.mutate()}>
        Log out
      </Menu.Item>
    </>
  );

  return (
    <ConsoleShell
      storageKey="organizer-portal-nav-collapsed"
      brand={{
        logo: (
          <Avatar src={organization?.logo_url ?? undefined} size={28} radius="sm" color="brand">
            <IconTicket size={18} />
          </Avatar>
        ),
        primary: organization?.name ?? "Mefie Tickets",
        secondary: "Organizer",
      }}
      account={{
        initials: `${user.first_name[0]}${user.last_name[0]}`,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        avatarColor: "brand",
        menuItems,
      }}
      headerEnd={<ThemeToggle />}
      nav={nav}
    >
      {children}
    </ConsoleShell>
  );
}
