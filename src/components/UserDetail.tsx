"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Badge, Button, Group, Stack, Tabs, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBan, IconCheck } from "@tabler/icons-react";
import { redirectOnAdminAuthError } from "@/lib/adminAuthErrorRedirect";
import { AdminReasonModal } from "@/components/AdminReasonModal";
import { AuditLogFeed } from "@/components/AuditLogFeed";
import { restoreUser, suspendUser, type AdminUser } from "@/lib/platformUserApi";

const STATUS_COLOR: Record<string, string> = { ACTIVE: "teal", SUSPENDED: "orange" };

export function UserDetail({ initialUser, permissions }: { initialUser: AdminUser; permissions: string[] }) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);

  const has = (permission: string) => permissions.includes(permission);

  function handleError(error: Error) {
    if (redirectOnAdminAuthError(error, router)) return;
    notifications.show({ color: "red", message: error.message });
  }

  const suspendMutation = useMutation({
    mutationFn: (reason: string) => suspendUser(user.id, reason),
    onSuccess: (data) => {
      setUser(data.user);
      setSuspendModalOpen(false);
      notifications.show({ color: "teal", message: "User suspended." });
    },
    onError: handleError,
  });

  const restoreMutation = useMutation({
    mutationFn: (reason: string) => restoreUser(user.id, reason),
    onSuccess: (data) => {
      setUser(data.user);
      setRestoreModalOpen(false);
      notifications.show({ color: "teal", message: "User restored." });
    },
    onError: handleError,
  });

  return (
    <Stack gap="xl" maw={880}>
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Title order={2} fz={28}>
            {user.first_name} {user.last_name}
          </Title>
          <Text c="dimmed" size="sm">
            {user.email}
          </Text>
        </Stack>
        <Badge color={STATUS_COLOR[user.status] ?? "gray"} variant="light" size="lg">
          {user.status}
        </Badge>
      </Group>

      <Group>
        {user.status !== "SUSPENDED" && has("users.suspend") && (
          <Button color="orange" leftSection={<IconBan size={16} />} onClick={() => setSuspendModalOpen(true)}>
            Suspend
          </Button>
        )}
        {user.status === "SUSPENDED" && has("users.restore") && (
          <Button color="teal" leftSection={<IconCheck size={16} />} onClick={() => setRestoreModalOpen(true)}>
            Restore
          </Button>
        )}
      </Group>

      {user.suspended_reason && (
        <Text size="sm" c="dimmed">
          Suspended: {user.suspended_reason}
        </Text>
      )}

      <Tabs defaultValue="activity">
        <Tabs.List>
          <Tabs.Tab value="activity">Activity</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="activity" pt="md">
          <AuditLogFeed userId={user.id} />
        </Tabs.Panel>
      </Tabs>

      <AdminReasonModal
        opened={suspendModalOpen}
        onClose={() => setSuspendModalOpen(false)}
        title="Suspend user?"
        description="Immediately rotates their security stamp — their next request with an existing ordinary session is rejected as revoked, and (if they also hold a Platform membership) their privileged admin session is revoked too."
        confirmLabel="Suspend"
        loading={suspendMutation.isPending}
        onConfirm={(reason) => suspendMutation.mutate(reason)}
      />
      <AdminReasonModal
        opened={restoreModalOpen}
        onClose={() => setRestoreModalOpen(false)}
        title="Restore user?"
        confirmLabel="Restore"
        confirmColor="teal"
        loading={restoreMutation.isPending}
        onConfirm={(reason) => restoreMutation.mutate(reason)}
      />
    </Stack>
  );
}
