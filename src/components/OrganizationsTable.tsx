"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Card,
  Group,
  Pagination,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { redirectOnAdminAuthError } from "@/lib/adminAuthErrorRedirect";
import { listOrganizations, type AdminOrganization, type PageMeta } from "@/lib/platformOrganizationApi";

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "teal",
  PENDING_VERIFICATION: "yellow",
  SUSPENDED: "orange",
  ARCHIVED: "gray",
};

export function OrganizationsTable({
  initialOrganizations,
  initialMeta,
}: {
  initialOrganizations: AdminOrganization[];
  initialMeta: PageMeta;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["admin-organizations", q, status, page],
    queryFn: () => listOrganizations({ q: q || undefined, status: status || undefined, page }),
    placeholderData: (previous) => previous,
    initialData: q === "" && !status && page === 1 ? { organizations: initialOrganizations, meta: initialMeta } : undefined,
    retry: false,
  });

  if (query.isError) {
    redirectOnAdminAuthError(query.error, router);
  }

  const organizations = query.data?.organizations ?? [];
  const meta = query.data?.meta ?? initialMeta;

  return (
    <Stack gap="xl" maw={1080}>
      <Title order={2} fz={28}>
        Organizations
      </Title>

      <Group>
        <TextInput
          placeholder="Search by name, slug, or email"
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
          data={["ACTIVE", "PENDING_VERIFICATION", "SUSPENDED", "ARCHIVED"]}
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          clearable
          w={200}
        />
      </Group>

      <Card withBorder radius="lg" p={0} style={{ overflow: "hidden" }}>
        <Table.ScrollContainer minWidth={800}>
          <Table verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Payouts</Table.Th>
                <Table.Th>Created</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {organizations.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text c="dimmed" ta="center" py="lg">
                      No organizations found.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
              {organizations.map((org) => (
                <Table.Tr key={org.id} style={{ cursor: "pointer" }}>
                  <Table.Td>
                    <Text component={Link} href={`/admin/organizations/${org.id}`} fw={500} c="inherit">
                      {org.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {org.slug}
                    </Text>
                  </Table.Td>
                  <Table.Td>{org.email}</Table.Td>
                  <Table.Td>
                    <Badge color={STATUS_COLOR[org.status] ?? "gray"} variant="light">
                      {org.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {org.payout_restricted_at ? (
                      <Badge color="red" variant="light">
                        Restricted
                      </Badge>
                    ) : (
                      <Text size="sm" c="dimmed">
                        —
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>{new Date(org.created_at).toLocaleDateString()}</Table.Td>
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
