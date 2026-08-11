"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Badge, Button, Card, Group, Modal, Select, Stack, Table, Text, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconUserPlus } from "@tabler/icons-react";
import { redirectOnAdminAuthError } from "@/lib/adminAuthErrorRedirect";
import { ApiError, type PlatformRole } from "@/lib/authApi";
import {
  cancelAdminInvitation,
  INVITABLE_PLATFORM_ROLES,
  removeAdminStaff,
  restoreAdminStaff,
  suspendAdminStaff,
  updateAdminStaffRole,
  type AdminUserRow,
} from "@/lib/platformAdminUsersApi";
import { InviteAdminStaffForm, type InvitedAdminStaff } from "@/components/InviteAdminStaffForm";

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "teal",
  PENDING: "yellow",
  SUSPENDED: "orange",
  REMOVED: "gray",
  EXPIRED: "gray",
};

const ROLE_LABEL: Record<PlatformRole, string> = {
  PLATFORM_SUPER_ADMIN: "Super Admin",
  PLATFORM_OPERATIONS: "Operations",
  PLATFORM_FINANCE: "Finance",
  PLATFORM_SUPPORT: "Support",
};

export function AdminStaffTable({ initialRows }: { initialRows: AdminUserRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [inviteOpen, setInviteOpen] = useState(false);
  const router = useRouter();

  function removeRow(predicate: (row: AdminUserRow) => boolean) {
    setRows((prev) => prev.filter((row) => !predicate(row)));
  }

  function addInvitationRow(invitation: InvitedAdminStaff) {
    setRows((prev) => [
      {
        type: "invitation",
        id: invitation.id,
        first_name: invitation.first_name,
        last_name: invitation.last_name,
        email: invitation.email,
        role: invitation.role,
        status: "PENDING",
        date_added: new Date().toISOString(),
      },
      ...prev,
    ]);
  }

  function handleError(error: Error) {
    if (redirectOnAdminAuthError(error, router)) return true;
    notifications.show({
      color: "red",
      message: error instanceof ApiError ? error.message : "Something went wrong.",
    });
    return false;
  }

  const cancelMutation = useMutation({
    mutationFn: (invitationId: number) => cancelAdminInvitation(invitationId),
    onSuccess: (_data, invitationId) => {
      removeRow((row) => row.type === "invitation" && row.id === invitationId);
      notifications.show({ color: "teal", message: "Invitation cancelled." });
    },
    onError: handleError,
  });

  const removeMutation = useMutation({
    mutationFn: (membershipId: number) => removeAdminStaff(membershipId),
    onSuccess: (_data, membershipId) => {
      removeRow((row) => row.type === "member" && row.id === membershipId);
      notifications.show({ color: "teal", message: "Staff member removed." });
    },
    onError: handleError,
  });

  const suspendMutation = useMutation({
    mutationFn: (membershipId: number) => suspendAdminStaff(membershipId),
    onSuccess: (_data, membershipId) => {
      setRows((prev) =>
        prev.map((row) => (row.type === "member" && row.id === membershipId ? { ...row, status: "SUSPENDED" } : row)),
      );
      notifications.show({ color: "teal", message: "Staff member suspended — their privileged session was revoked." });
    },
    onError: handleError,
  });

  const restoreMutation = useMutation({
    mutationFn: (membershipId: number) => restoreAdminStaff(membershipId),
    onSuccess: (_data, membershipId) => {
      setRows((prev) =>
        prev.map((row) => (row.type === "member" && row.id === membershipId ? { ...row, status: "ACTIVE" } : row)),
      );
      notifications.show({ color: "teal", message: "Staff member restored." });
    },
    onError: handleError,
  });

  const roleMutation = useMutation({
    mutationFn: ({ membershipId, role }: { membershipId: number; role: PlatformRole }) =>
      updateAdminStaffRole(membershipId, role),
    onSuccess: (_data, { membershipId, role }) => {
      setRows((prev) => prev.map((row) => (row.type === "member" && row.id === membershipId ? { ...row, role } : row)));
      notifications.show({ color: "teal", message: "Role updated — their privileged session was revoked." });
    },
    onError: handleError,
  });

  function confirmRemove(row: Extract<AdminUserRow, { type: "member" }>) {
    modals.openConfirmModal({
      title: "Remove staff access?",
      centered: true,
      children: (
        <Text size="sm">
          {row.first_name} {row.last_name} will lose access to the Admin Console immediately.
        </Text>
      ),
      labels: { confirm: "Remove", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => removeMutation.mutate(row.id),
    });
  }

  function confirmCancelInvitation(row: Extract<AdminUserRow, { type: "invitation" }>) {
    modals.openConfirmModal({
      title: "Cancel invitation?",
      centered: true,
      children: <Text size="sm">The invitation link sent to {row.email} will stop working.</Text>,
      labels: { confirm: "Cancel invitation", cancel: "Keep invitation" },
      confirmProps: { color: "red" },
      onConfirm: () => cancelMutation.mutate(row.id),
    });
  }

  return (
    <Stack gap="xl" maw={960}>
      <Group justify="space-between">
        <Title order={2} fz={28}>
          Admin Users
        </Title>
        <Button leftSection={<IconUserPlus size={16} />} onClick={() => setInviteOpen(true)}>
          Invite staff
        </Button>
      </Group>

      <Card withBorder radius="lg" p={0} style={{ overflow: "hidden" }}>
        <Table.ScrollContainer minWidth={760}>
          <Table verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Added</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text c="dimmed" ta="center" py="lg">
                      No admin staff yet.
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
                  <Table.Td>
                    {row.type === "member" && row.status === "ACTIVE" ? (
                      <Select
                        size="xs"
                        w={150}
                        data={INVITABLE_PLATFORM_ROLES}
                        value={row.role}
                        allowDeselect={false}
                        disabled={roleMutation.isPending}
                        onChange={(value) => value && roleMutation.mutate({ membershipId: row.id, role: value as PlatformRole })}
                      />
                    ) : (
                      <Badge variant="light">{ROLE_LABEL[row.role]}</Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={STATUS_COLOR[row.status] ?? "gray"} variant="light">
                      {row.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{new Date(row.date_added).toLocaleDateString()}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      {row.type === "member" && row.status === "ACTIVE" && (
                        <>
                          <Button size="compact-xs" color="orange" variant="subtle" onClick={() => suspendMutation.mutate(row.id)}>
                            Suspend
                          </Button>
                          <Button size="compact-xs" color="red" variant="subtle" onClick={() => confirmRemove(row)}>
                            Remove
                          </Button>
                        </>
                      )}
                      {row.type === "member" && row.status === "SUSPENDED" && (
                        <Button size="compact-xs" color="teal" variant="subtle" onClick={() => restoreMutation.mutate(row.id)}>
                          Restore
                        </Button>
                      )}
                      {row.type === "invitation" && row.status === "PENDING" && (
                        <Button size="compact-xs" color="red" variant="subtle" onClick={() => confirmCancelInvitation(row)}>
                          Cancel
                        </Button>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>

      <Modal opened={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite Admin Console staff">
        <InviteAdminStaffForm
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
