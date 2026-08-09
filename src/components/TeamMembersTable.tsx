"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconUserPlus } from "@tabler/icons-react";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import {
  ASSIGNABLE_ROLES,
  cancelInvitation,
  removeTeamMember,
  updateTeamMemberRole,
  type TeamRow,
} from "@/lib/teamApi";
import { InviteOrganizerForm, type InvitedTeammate } from "@/components/InviteOrganizerForm";

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "teal",
  PENDING: "yellow",
  SUSPENDED: "orange",
  REMOVED: "gray",
  EXPIRED: "gray",
};

export function TeamMembersTable({ initialRows, canEdit }: { initialRows: TeamRow[]; canEdit: boolean }) {
  const [rows, setRows] = useState(initialRows);
  const [inviteOpen, setInviteOpen] = useState(false);
  const router = useRouter();

  function removeRow(predicate: (row: TeamRow) => boolean) {
    setRows((prev) => prev.filter((row) => !predicate(row)));
  }

  function addInvitationRow(invitation: InvitedTeammate) {
    setRows((prev) => [
      {
        type: "invitation",
        id: invitation.id,
        first_name: invitation.first_name,
        last_name: invitation.last_name,
        email: invitation.email,
        phone: invitation.phone,
        role: invitation.role,
        status: "PENDING",
        date_added: new Date().toISOString(),
      },
      ...prev,
    ]);
  }

  function handleAuthOrErrorToast(error: Error) {
    if (redirectOnAuthError(error, router)) return true;
    notifications.show({
      color: "red",
      message: error instanceof ApiError ? error.message : "Something went wrong.",
    });
    return false;
  }

  const cancelMutation = useMutation({
    mutationFn: (invitationId: number) => cancelInvitation(invitationId),
    onSuccess: (_data: { cancelled: true }, invitationId: number) => {
      removeRow((row) => row.type === "invitation" && row.id === invitationId);
      notifications.show({ color: "teal", message: "Invitation cancelled." });
    },
    onError: handleAuthOrErrorToast,
  });

  const removeMutation = useMutation({
    mutationFn: (membershipId: number) => removeTeamMember(membershipId),
    onSuccess: (_data: { removed: true }, membershipId: number) => {
      removeRow((row) => row.type === "member" && row.id === membershipId);
      notifications.show({ color: "teal", message: "Teammate removed." });
    },
    onError: handleAuthOrErrorToast,
  });

  const roleMutation = useMutation({
    mutationFn: ({ membershipId, role }: { membershipId: number; role: string }) =>
      updateTeamMemberRole(membershipId, role),
    onSuccess: (_data: unknown, { membershipId, role }: { membershipId: number; role: string }) => {
      setRows((prev) =>
        prev.map((row) =>
          row.type === "member" && row.id === membershipId
            ? { ...row, role: role as TeamRow["role"] }
            : row,
        ),
      );
      notifications.show({ color: "teal", message: "Role updated." });
    },
    onError: handleAuthOrErrorToast,
  });

  function confirmRemove(row: Extract<TeamRow, { type: "member" }>) {
    modals.openConfirmModal({
      title: "Remove teammate?",
      centered: true,
      children: (
        <Text size="sm">
          {row.first_name} {row.last_name} will lose access to this organization immediately. This can&apos;t be
          undone — they&apos;d need a new invitation to rejoin.
        </Text>
      ),
      labels: { confirm: "Remove", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => removeMutation.mutate(row.id),
    });
  }

  function confirmCancelInvitation(row: Extract<TeamRow, { type: "invitation" }>) {
    modals.openConfirmModal({
      title: "Cancel invitation?",
      centered: true,
      children: (
        <Text size="sm">
          The invitation link sent to {row.email} will stop working.
        </Text>
      ),
      labels: { confirm: "Cancel invitation", cancel: "Keep invitation" },
      confirmProps: { color: "red" },
      onConfirm: () => cancelMutation.mutate(row.id),
    });
  }

  return (
    <Stack gap="xl" maw={880}>
      <Group justify="space-between">
        <Title order={2} fz={28}>
          Team
        </Title>
        {canEdit && (
          <Button leftSection={<IconUserPlus size={16} />} onClick={() => setInviteOpen(true)}>
            Invite organizer
          </Button>
        )}
      </Group>

      <Card withBorder radius="lg" p={0} style={{ overflow: "hidden" }}>
        <Table.ScrollContainer minWidth={700}>
        <Table verticalSpacing="sm" horizontalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Phone</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Added</Table.Th>
              {canEdit && <Table.Th />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={canEdit ? 7 : 6}>
                  <Text c="dimmed" ta="center" py="lg">
                    No teammates yet.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {rows.map((row) => (
              <Table.Tr key={`${row.type}-${row.id}`}>
                <Table.Td>
                  {row.first_name} {row.last_name}
                </Table.Td>
                <Table.Td>{row.email}</Table.Td>
                <Table.Td>{row.phone ?? "—"}</Table.Td>
                <Table.Td>
                  {canEdit && row.type === "member" && row.status === "ACTIVE" ? (
                    <Select
                      size="xs"
                      w={130}
                      data={ASSIGNABLE_ROLES}
                      value={row.role}
                      allowDeselect={false}
                      disabled={roleMutation.isPending}
                      onChange={(value) => value && roleMutation.mutate({ membershipId: row.id, role: value })}
                    />
                  ) : (
                    <Badge variant="light">{row.role}</Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Badge color={STATUS_COLOR[row.status] ?? "gray"} variant="light">
                    {row.status}
                  </Badge>
                </Table.Td>
                <Table.Td>{new Date(row.date_added).toLocaleDateString()}</Table.Td>
                {canEdit && (
                  <Table.Td>
                    {row.type === "member" && row.status === "ACTIVE" && (
                      <Button size="compact-xs" color="red" variant="subtle" onClick={() => confirmRemove(row)}>
                        Remove
                      </Button>
                    )}
                    {row.type === "invitation" && row.status === "PENDING" && (
                      <Button
                        size="compact-xs"
                        color="red"
                        variant="subtle"
                        onClick={() => confirmCancelInvitation(row)}
                      >
                        Cancel
                      </Button>
                    )}
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        </Table.ScrollContainer>
      </Card>

      <Modal opened={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite an organizer">
        <InviteOrganizerForm
          onSuccess={(invitation) => {
            addInvitationRow(invitation);
            setInviteOpen(false);
          }}
          onCancel={() => setInviteOpen(false)}
        />
      </Modal>
    </Stack>
  );
}
