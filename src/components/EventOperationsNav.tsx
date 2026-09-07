"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLink, Stack, Text } from "@mantine/core";
import {
  IconGift,
  IconLayoutDashboard,
  IconRoute,
  IconScan,
  IconSettings,
  IconDeviceMobile,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";

type NavItem = { label: string; suffix: string; icon: Icon; alsoActiveOn?: string[] };
type NavSection = { heading: string | null; items: NavItem[] };

const sections: NavSection[] = [
  {
    heading: null,
    items: [{ label: "Overview", suffix: "", icon: IconLayoutDashboard }],
  },
  {
    heading: "Event configuration",
    items: [{ label: "Event Settings", suffix: "/settings", icon: IconSettings }],
  },
  {
    heading: "Manage",
    items: [
      { label: "Orders & Attendees", suffix: "/orders", icon: IconUsers, alsoActiveOn: ["/attendees"] },
      { label: "Complimentary", suffix: "/complimentary", icon: IconGift },
    ],
  },
  {
    heading: "Gate & scanning",
    items: [
      { label: "Entrances & ticket routing", suffix: "/gates", icon: IconRoute },
      { label: "Scanner setup", suffix: "/scanner-setup", icon: IconDeviceMobile },
      { label: "Gate operations", suffix: "/gate-operations", icon: IconScan },
    ],
  },
];

export function EventOperationsNav({ eventId }: { eventId: number }) {
  const pathname = usePathname();
  const base = `/events/${eventId}`;

  return (
    <Stack gap="lg" role="navigation" aria-label="Event operations">
      {sections.map((section) => (
        <Stack key={section.heading ?? "root"} gap={2}>
          {section.heading && (
            <Text tt="uppercase" fz={11} fw={700} c="dimmed" px="sm" mb={4}>
              {section.heading}
            </Text>
          )}
          {section.items.map((item) => {
            const href = `${base}${item.suffix}`;
            const active =
              item.suffix === ""
                ? pathname === base
                : pathname.startsWith(href) ||
                  (item.alsoActiveOn ?? []).some((extra) => pathname.startsWith(`${base}${extra}`));
            const Icon = item.icon;
            return (
              <NavLink
                key={href}
                component={Link}
                href={href}
                label={item.label}
                leftSection={<Icon size={18} />}
                active={active}
              />
            );
          })}
        </Stack>
      ))}
    </Stack>
  );
}
