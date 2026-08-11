"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Badge, Card, Group, Pagination, Select, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { redirectOnAdminAuthError } from "@/lib/adminAuthErrorRedirect";
import { listAdminUsers, type AdminUser } from "@/lib/platformUserApi";
import type { PageMeta } from "@/lib/platformOrganizationApi";

const STATUS_COLOR: Record<string, string> = { ACTIVE: "teal", SUSPENDED: "orange" };

export function UsersTable({ initialUsers, initialMeta }: { initialUsers: AdminUser[]; initialMeta: PageMeta }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["admin-users", q, status, page],
    queryFn: () => listAdminUsers({ q: q || undefined, status: status || undefined, page }),
    placeholderData: (previous) => previous,
    initialData: q === "" && !status && page === 1 ? { users: initialUsers, meta: initialMeta } : undefined,
    retry: false,
  });

  if (query.isError) {
    redirectOnAdminAuthError(query.error, router);
  }

  const users = query.data?.users ?? [];
  const meta = query.data?.meta ?? initialMeta;

  return (
    <Stack gap="xl" maw={1080}>
      <Title order={2} fz={28}>
        Users
      </Title>

      <Group>
        <TextInput
          placeholder="Search by name or email"
          leftSection={<IconSearch size={16} />}
          value={q}
          onChange={(event) => {
            setQ(event.currentTarget.value);
            setPage(1);
          }}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="Status"
          data={["ACTIVE", "SUSPENDED"]}
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          clearable
          w={180}
        />
      </Group>

      <Card withBorder radius="lg" p={0} style={{ overflow: "hidden" }}>
        <Table.ScrollContainer minWidth={700}>
          <Table verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Joined</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text c="dimmed" ta="center" py="lg">
                      No users found.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
              {users.map((user) => (
                <Table.Tr key={user.id}>
                  <Table.Td>
                    <Text component={Link} href={`/admin/users/${user.id}`} fw={500} c="inherit">
                      {user.first_name} {user.last_name}
                    </Text>
                  </Table.Td>
                  <Table.Td>{user.email}</Table.Td>
                  <Table.Td>
                    <Badge color={STATUS_COLOR[user.status] ?? "gray"} variant="light">
                      {user.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{new Date(user.created_at).toLocaleDateString()}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>

      {meta.last_page > 1 && (
        <Group justify="center">
          <Pagination total={meta.last_page} value={meta.current_page} onChange={setPage} />
        </Group>
      )}
    </Stack>
  );
}
