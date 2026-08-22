"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBan, IconCheck, IconLock, IconLockOpen } from "@tabler/icons-react";
import { redirectOnAdminAuthError } from "@/lib/adminAuthErrorRedirect";
import { AdminReasonModal } from "@/components/AdminReasonModal";
import { OrganizationWorkspaceTabs } from "@/components/OrganizationWorkspaceTabs";
import {
  clearPayoutRestriction,
  createOrganizationNote,
  listOrganizationNotes,
  restoreOrganization,
  setPayoutRestriction,
  suspendOrganization,
  type AdminOrganization,
} from "@/lib/platformOrganizationApi";

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "teal",
  PENDING_VERIFICATION: "yellow",
  SUSPENDED: "orange",
  ARCHIVED: "gray",
};

export function OrganizationDetail({
  initialOrganization,
  permissions,
}: {
  initialOrganization: AdminOrganization;
  permissions: string[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [organization, setOrganization] = useState(initialOrganization);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restrictModalOpen, setRestrictModalOpen] = useState(false);
  const [clearRestrictModalOpen, setClearRestrictModalOpen] = useState(false);
  const [noteBody, setNoteBody] = useState("");

  const has = (permission: string) => permissions.includes(permission);

  function handleError(error: Error) {
    if (redirectOnAdminAuthError(error, router)) return;
    notifications.show({ color: "red", message: error.message });
  }

  const suspendMutation = useMutation({
    mutationFn: (reason: string) => suspendOrganization(organization.id, reason),
    onSuccess: (data) => {
      setOrganization(data.organization);
      setSuspendModalOpen(false);
      notifications.show({ color: "teal", message: "Organization suspended." });
    },
    onError: handleError,
  });

  const restoreMutation = useMutation({
    mutationFn: (reason: string) => restoreOrganization(organization.id, reason),
    onSuccess: (data) => {
      setOrganization(data.organization);
      setRestoreModalOpen(false);
      notifications.show({ color: "teal", message: "Organization restored." });
    },
    onError: handleError,
  });

  const restrictMutation = useMutation({
    mutationFn: (reason: string) => setPayoutRestriction(organization.id, reason),
    onSuccess: (data) => {
      setOrganization(data.organization);
      setRestrictModalOpen(false);
      notifications.show({ color: "teal", message: "Payout restriction applied." });
    },
    onError: handleError,
  });

  const clearRestrictMutation = useMutation({
    mutationFn: (reason: string) => clearPayoutRestriction(organization.id, reason),
    onSuccess: (data) => {
      setOrganization(data.organization);
      setClearRestrictModalOpen(false);
      notifications.show({ color: "teal", message: "Payout restriction removed." });
    },
    onError: handleError,
  });

  const notesQuery = useQuery({
    queryKey: ["admin-organization-notes", organization.id],
    queryFn: () => listOrganizationNotes(organization.id),
    retry: false,
  });

  const addNoteMutation = useMutation({
    mutationFn: (body: string) => createOrganizationNote(organization.id, body),
    onSuccess: () => {
      setNoteBody("");
      queryClient.invalidateQueries({ queryKey: ["admin-organization-notes", organization.id] });
    },
    onError: handleError,
  });

  const isArchived = organization.status === "ARCHIVED";

  return (
    <Stack gap="xl" maw={1280}>
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Title order={2} fz={28}>
            {organization.name}
          </Title>
          <Text c="dimmed" size="sm">
            {organization.slug} · {organization.email}
          </Text>
          <Text c="dimmed" size="xs">
            Created {new Date(organization.created_at).toLocaleDateString()} · {organization.timezone} · {organization.currency}
          </Text>
        </Stack>
        <Badge color={STATUS_COLOR[organization.status] ?? "gray"} variant="light" size="lg">
          {organization.status}
        </Badge>
      </Group>

      <Group>
        {!isArchived && organization.status !== "SUSPENDED" && has("organizations.suspend") && (
          <Button color="orange" leftSection={<IconBan size={16} />} onClick={() => setSuspendModalOpen(true)}>
            Suspend
          </Button>
        )}
        {!isArchived && organization.status === "SUSPENDED" && has("organizations.restore") && (
          <Button color="teal" leftSection={<IconCheck size={16} />} onClick={() => setRestoreModalOpen(true)}>
            Restore
          </Button>
        )}
        {has("organizations.payout_restriction.manage") &&
          (organization.payout_restricted_at ? (
            <Button
              variant="outline"
              color="teal"
              leftSection={<IconLockOpen size={16} />}
              onClick={() => setClearRestrictModalOpen(true)}
            >
              Remove payout restriction
            </Button>
          ) : (
            <Button
              variant="outline"
              color="red"
              leftSection={<IconLock size={16} />}
              onClick={() => setRestrictModalOpen(true)}
            >
              Restrict payouts
            </Button>
          ))}
      </Group>

      {organization.payout_restricted_at && (
        <Card withBorder radius="lg" p="md" style={{ borderColor: "var(--mantine-color-red-6)" }}>
          <Text fw={600} c="red">
            Payouts restricted
          </Text>
          <Text size="sm" c="dimmed">
            {organization.payout_restricted_reason}
          </Text>
        </Card>
      )}

      <OrganizationWorkspaceTabs organizationId={organization.id} permissions={permissions} notesPanel={
          <Stack>
            {has("organizations.notes.create") && (
              <Card withBorder radius="lg" p="md">
                <Stack gap="sm">
                  <Textarea
                    placeholder="Add an internal note — visible to any platform staff who can view this organization."
                    minRows={2}
                    autosize
                    value={noteBody}
                    onChange={(event) => setNoteBody(event.currentTarget.value)}
                  />
                  <Group justify="flex-end">
                    <Button
                      size="xs"
                      loading={addNoteMutation.isPending}
                      disabled={noteBody.trim().length === 0}
                      onClick={() => addNoteMutation.mutate(noteBody.trim())}
                    >
                      Add note
                    </Button>
                  </Group>
                </Stack>
              </Card>
            )}

            {(notesQuery.data?.notes ?? []).map((note) => (
              <Card key={note.id} withBorder radius="lg" p="md">
                <Text size="sm">{note.body}</Text>
                <Text size="xs" c="dimmed" mt="xs">
                  {note.author ? `${note.author.first_name} ${note.author.last_name}` : "Unknown"} ·{" "}
                  {new Date(note.created_at).toLocaleString()}
                </Text>
              </Card>
            ))}

            {notesQuery.data?.notes.length === 0 && (
              <Text c="dimmed" ta="center" py="lg">
                No notes yet.
              </Text>
            )}
          </Stack>
      } />

      <AdminReasonModal
        opened={suspendModalOpen}
        onClose={() => setSuspendModalOpen(false)}
        title="Suspend organization?"
        description={`${organization.name} will be flagged as suspended. This round only sets status and the audit trail — no downstream customer-facing gating.`}
        confirmLabel="Suspend"
        loading={suspendMutation.isPending}
        onConfirm={(reason) => suspendMutation.mutate(reason)}
      />
      <AdminReasonModal
        opened={restoreModalOpen}
        onClose={() => setRestoreModalOpen(false)}
        title="Restore organization?"
        confirmLabel="Restore"
        confirmColor="teal"
        loading={restoreMutation.isPending}
        onConfirm={(reason) => restoreMutation.mutate(reason)}
      />
      <AdminReasonModal
        opened={restrictModalOpen}
        onClose={() => setRestrictModalOpen(false)}
        title="Restrict payouts?"
        description="Blocks payout release for this organization, even for a Super Admin, until explicitly cleared."
        confirmLabel="Restrict"
        loading={restrictMutation.isPending}
        onConfirm={(reason) => restrictMutation.mutate(reason)}
      />
      <AdminReasonModal
        opened={clearRestrictModalOpen}
        onClose={() => setClearRestrictModalOpen(false)}
        title="Remove payout restriction?"
        confirmLabel="Remove restriction"
        confirmColor="teal"
        loading={clearRestrictMutation.isPending}
        onConfirm={(reason) => clearRestrictMutation.mutate(reason)}
      />
    </Stack>
  );
}
