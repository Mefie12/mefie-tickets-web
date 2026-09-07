"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Avatar, Group, Menu, Text, UnstyledButton } from "@mantine/core";
import {
  IconBuildingStore,
  IconChevronDown,
  IconExternalLink,
  IconLayoutDashboard,
  IconLogout,
  IconLogout2,
  IconSettings,
  IconTicket,
} from "@tabler/icons-react";

export type NavUser = {
  firstName: string;
  lastName: string;
  hasOrganization: boolean;
  organization: { name: string; slug: string; logoUrl: string | null } | null;
} | null;

export type NavConsumer = { first_name: string | null; email: string } | null;

export type SignOutKind = "organizer" | "consumer" | "consumer-all";

type AccountAction = {
  key: string;
  label: string;
  href?: string;
  onSelect?: () => void;
  icon: ReactNode;
  color?: string;
};

type AccountSection = { key: string; label: string; actions: AccountAction[] };

/** Whether the top-right slot renders the org identity (vs. a person avatar). */
export function isOrgMode(user: NavUser): user is NavUser & { organization: { name: string; slug: string; logoUrl: string | null } } {
  return Boolean(user?.hasOrganization && user.organization);
}

function initials(a: string | null | undefined, b?: string | null): string {
  return `${a?.[0] ?? ""}${b?.[0] ?? ""}`.toUpperCase() || "?";
}

/** The avatar/logo + name shown in the bar and at the top of the mobile drawer. */
export function AccountIdentity({
  user,
  consumer,
  withName = true,
}: {
  user: NavUser;
  consumer: NavConsumer;
  withName?: boolean;
}) {
  if (isOrgMode(user)) {
    const org = user.organization;
    return (
      <Group gap="xs" wrap="nowrap">
        <Avatar src={org.logoUrl} alt={org.name} size="sm" radius="sm" color="brand">
          {initials(org.name)}
        </Avatar>
        {withName && (
          <Text size="sm" fw={600} lineClamp={1} maw={160}>
            {org.name}
          </Text>
        )}
      </Group>
    );
  }

  const name = user ? user.firstName : (consumer?.first_name ?? "Account");
  const avatarInitials = user ? initials(user.firstName, user.lastName) : initials(consumer?.first_name, null);

  return (
    <Group gap="xs" wrap="nowrap">
      <Avatar size="sm" radius="xl" color="brand">
        {avatarInitials}
      </Avatar>
      {withName && (
        <Text size="sm" fw={600} lineClamp={1} maw={140}>
          {name}
        </Text>
      )}
    </Group>
  );
}

/**
 * One section per identity the visitor actually holds. `signOut` is
 * called with the identity kind; the caller runs the request + refresh.
 */
export function buildAccountSections(
  user: NavUser,
  consumer: NavConsumer,
  signOut: (kind: SignOutKind) => void,
): AccountSection[] {
  const sections: AccountSection[] = [];

  if (user && isOrgMode(user)) {
    sections.push({
      key: "organizer",
      label: user.organization.name,
      actions: [
        { key: "dashboard", label: "Organizer dashboard", href: "/dashboard", icon: <IconLayoutDashboard size={16} /> },
        {
          key: "public-page",
          label: "View your public page",
          href: `/${user.organization.slug}`,
          icon: <IconExternalLink size={16} />,
        },
        { key: "settings", label: "Organizer account settings", href: "/settings", icon: <IconSettings size={16} /> },
        { key: "logout", label: "Log out", onSelect: () => signOut("organizer"), icon: <IconLogout size={16} /> },
      ],
    });
  } else if (user) {
    sections.push({
      key: "distributor",
      label: "Distributor",
      actions: [
        { key: "portal", label: "Distributor portal", href: "/distributor", icon: <IconBuildingStore size={16} /> },
        { key: "logout", label: "Log out", onSelect: () => signOut("organizer"), icon: <IconLogout size={16} /> },
      ],
    });
  }

  if (consumer) {
    sections.push({
      key: "attendee",
      label: consumer.email,
      actions: [
        { key: "tickets", label: "My Tickets", href: "/tickets", icon: <IconTicket size={16} /> },
        { key: "signout", label: "Sign out", onSelect: () => signOut("consumer"), icon: <IconLogout size={16} /> },
        {
          key: "signout-all",
          label: "Sign out everywhere",
          onSelect: () => signOut("consumer-all"),
          icon: <IconLogout2 size={16} />,
          color: "red",
        },
      ],
    });
  }

  return sections;
}

/** Desktop bar: the identity anchor + a grouped dropdown of every held identity. */
export function PublicAccountMenu({
  user,
  consumer,
  onSignOut,
}: {
  user: NavUser;
  consumer: NavConsumer;
  onSignOut: (kind: SignOutKind) => void;
}) {
  const sections = buildAccountSections(user, consumer, onSignOut);

  return (
    <Menu position="bottom-end" width={264} shadow="md">
      <Menu.Target>
        <UnstyledButton aria-label="Account menu">
          <Group gap={6} wrap="nowrap">
            <AccountIdentity user={user} consumer={consumer} withName />
            <IconChevronDown size={14} />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        {sections.map((section, i) => (
          <div key={section.key}>
            {i > 0 && <Menu.Divider />}
            <Menu.Label>{section.label}</Menu.Label>
            {section.actions.map((action) =>
              action.href ? (
                <Menu.Item key={action.key} component={Link} href={action.href} leftSection={action.icon} color={action.color}>
                  {action.label}
                </Menu.Item>
              ) : (
                <Menu.Item key={action.key} onClick={action.onSelect} leftSection={action.icon} color={action.color}>
                  {action.label}
                </Menu.Item>
              ),
            )}
          </div>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
