"use client";

import Link from "next/link";
import { Card, Group, SimpleGrid, Text } from "@mantine/core";
import {
  IconBuildingStore,
  IconClipboardList,
  IconUserShield,
  IconUsers,
} from "@tabler/icons-react";

const TILES = [
  {
    href: "/admin/organizations",
    permission: "organizations.view",
    icon: IconBuildingStore,
    title: "Organizations",
    description: "Search, suspend/restore, manage payout restrictions and internal notes.",
  },
  {
    href: "/admin/users",
    permission: "users.view",
    icon: IconUsers,
    title: "Users",
    description: "Search customer-side accounts and manage suspensions.",
  },
  {
    href: "/admin/admin-users",
    permission: "admin_users.view",
    icon: IconUserShield,
    title: "Admin Users",
    description: "Invite and manage Mefie Admin Console staff.",
  },
  {
    href: "/admin/audit-log",
    permission: "audit_log.view",
    icon: IconClipboardList,
    title: "Audit Log",
    description: "Every administrative and security event, in one feed.",
  },
];

export function AdminDashboardTiles({ permissions }: { permissions: string[] }) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      {TILES.filter((tile) => permissions.includes(tile.permission)).map((tile) => (
        <Card key={tile.href} component={Link} href={tile.href} withBorder radius="lg" p="lg">
          <Group gap="sm">
            <tile.icon size={22} />
            <Text fw={600}>{tile.title}</Text>
          </Group>
          <Text size="sm" c="dimmed" mt="xs">
            {tile.description}
          </Text>
        </Card>
      ))}
    </SimpleGrid>
  );
}
