"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Badge, Card, Group, Loader, Stack, Text } from "@mantine/core";
import { redirectOnAdminAuthError } from "@/lib/adminAuthErrorRedirect";
import { listAuditLog } from "@/lib/auditLogApi";

/**
 * Renders a feed of audit_log rows — global (no props) or scoped to a
 * single organization/user (an org/user detail page's Activity tab).
 * Read-only: no edit/delete action is ever wired to this resource.
 */
export function AuditLogFeed({ organizationId, userId }: { organizationId?: string; userId?: number }) {
  const router = useRouter();

  const query = useQuery({
    queryKey: ["admin-audit-log", organizationId ?? null, userId ?? null],
    queryFn: () => listAuditLog({ organization_id: organizationId, user_id: userId }),
    retry: false,
  });

  if (query.isError) {
    redirectOnAdminAuthError(query.error, router);
    return null;
  }

  if (query.isLoading) {
    return (
      <Group justify="center" py="lg">
        <Loader size="sm" />
      </Group>
    );
  }

  const entries = query.data?.entries ?? [];

  if (entries.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="lg">
        No activity recorded yet.
      </Text>
    );
  }

  return (
    <Stack gap="xs">
      {entries.map((entry) => (
        <Card key={entry.id} withBorder radius="md" p="sm">
          <Group justify="space-between" wrap="nowrap">
            <Group gap="xs">
              <Badge variant="light" color={entry.log_name === "platform_security" ? "grape" : "blue"} size="sm">
                {entry.description}
              </Badge>
              {entry.properties.actor_platform_role && (
                <Text size="xs" c="dimmed">
                  {entry.causer ? `${entry.causer.first_name} ${entry.causer.last_name}` : "System"} (
                  {entry.properties.actor_platform_role})
                </Text>
              )}
            </Group>
            <Text size="xs" c="dimmed">
              {new Date(entry.created_at).toLocaleString()}
            </Text>
          </Group>
          {entry.properties.reason && (
            <Text size="sm" mt={4}>
              {entry.properties.reason}
            </Text>
          )}
        </Card>
      ))}
    </Stack>
  );
}
