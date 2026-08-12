"use client";

import Link from "next/link";
import { Button, Group } from "@mantine/core";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Overview", suffix: "" },
  { label: "Orders", suffix: "/orders" },
  { label: "Attendees", suffix: "/attendees" },
  { label: "Event Settings", suffix: "/settings" },
];

export function EventOperationsNav({ eventId }: { eventId: number }) {
  const pathname = usePathname();
  const base = `/events/${eventId}`;

  return (
    <Group gap="xs" role="navigation" aria-label="Event operations">
      {tabs.map((tab) => {
        const href = `${base}${tab.suffix}`;
        const active = tab.suffix === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Button key={href} component={Link} href={href} variant={active ? "filled" : "subtle"} size="compact-sm">
            {tab.label}
          </Button>
        );
      })}
    </Group>
  );
}
