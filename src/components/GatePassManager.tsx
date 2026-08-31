"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Code,
  Group,
  Loader,
  Modal,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  createGatePass,
  listGatePasses,
  revokeGatePass,
  rotateGatePassSecret,
  type GatePass,
} from "@/lib/gatePassApi";
import { resolveApiErrorMessage } from "@/lib/apiErrorMessages";
import { CopyLinkButton } from "@/components/CopyLinkButton";

/**
 * Organizer gate-pass CRUD (docs/17 §13.1). SCANNER = check-in only;
 * SUPERVISOR = check-in + undo. The secret is shown once, on create and
 * on rotate — gate staff use it at /gate.
 */
export function GatePassManager({ eventId }: { eventId: number }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["gate-passes", eventId],
    queryFn: () => listGatePasses(eventId),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [freshSecret, setFreshSecret] = useState<{ label: string; secret: string } | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["gate-passes", eventId] });

  const rotate = useMutation({
    mutationFn: (pass: GatePass) => rotateGatePassSecret(pass.id).then((r) => ({ label: pass.label, secret: r.secret })),
    onSuccess: (r) => {
      setFreshSecret(r);
      notifications.show({ color: "teal", message: "New secret issued — the old one no longer works." });
      invalidate();
    },
    onError: (e) => notifications.show({ color: "red", message: resolveApiErrorMessage(e) }),
  });

  const revoke = useMutation({
    mutationFn: (id: number) => revokeGatePass(id),
    onSuccess: () => {
      notifications.show({ color: "gray", message: "Gate pass revoked." });
      invalidate();
    },
    onError: (e) => notifications.show({ color: "red", message: resolveApiErrorMessage(e) }),
  });

  const passes = data?.gate_passes ?? [];

  return (
    <Stack gap="md" maw={620}>
      <Group justify="space-between">
        <Title order={2} fz={22}>
          Gate passes
        </Title>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          New pass
        </Button>
      </Group>

      <Text size="sm" c="dimmed">
        Gate staff sign in at <Code>/gate</Code> with a pass name + secret, the event ID ({eventId}), and a check-in list
        code.
      </Text>

      {freshSecret && (
        <Alert color="teal" variant="light" title={`Secret for “${freshSecret.label}”`} withCloseButton onClose={() => setFreshSecret(null)}>
          <Group>
            <Code>{freshSecret.secret}</Code>
            <CopyLinkButton value={freshSecret.secret} />
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            Shown once. Share it with the gate operator now.
          </Text>
        </Alert>
      )}

      {isLoading && <Loader size="sm" />}

      <Stack gap="sm">
        {passes.map((p) => (
          <Card key={p.id} withBorder radius="lg" p="md">
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <Stack gap={2} style={{ minWidth: 0 }}>
                <Group gap="xs">
                  <Text fw={600} truncate>
                    {p.label}
                  </Text>
                  <Badge size="sm" variant="light" color={p.role === "SUPERVISOR" ? "grape" : "gray"}>
                    {p.role}
                  </Badge>
                  {p.revoked_at && (
                    <Badge size="sm" variant="light" color="red">
                      Revoked
                    </Badge>
                  )}
                </Group>
                <Text size="xs" c="dimmed">
                  {p.can_view_contact ? "Can see attendee contact · " : ""}
                  {p.last_used_at ? `last used ${new Date(p.last_used_at).toLocaleString()}` : "never used"}
                </Text>
              </Stack>
              {!p.revoked_at && (
                <Group gap={6} wrap="nowrap">
                  <Button size="xs" variant="light" onClick={() => rotate.mutate(p)} loading={rotate.isPending}>
                    Rotate secret
                  </Button>
                  <Button size="xs" variant="subtle" color="red" onClick={() => revoke.mutate(p.id)} loading={revoke.isPending}>
                    Revoke
                  </Button>
                </Group>
              )}
            </Group>
          </Card>
        ))}
        {!isLoading && passes.length === 0 && (
          <Text size="sm" c="dimmed">
            No gate passes yet.
          </Text>
        )}
      </Stack>

      <CreateGatePassModal
        eventId={eventId}
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(r) => {
          setFreshSecret(r);
          setCreateOpen(false);
          invalidate();
        }}
      />
    </Stack>
  );
}

function CreateGatePassModal({
  eventId,
  opened,
  onClose,
  onCreated,
}: {
  eventId: number;
  opened: boolean;
  onClose: () => void;
  onCreated: (r: { label: string; secret: string }) => void;
}) {
  const [label, setLabel] = useState("");
  const [role, setRole] = useState<"SCANNER" | "SUPERVISOR">("SCANNER");
  const [canViewContact, setCanViewContact] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => {
      if (!label.trim()) return Promise.reject(new Error("Give the pass a name (e.g. “Main Entrance”)."));
      return createGatePass(eventId, { label: label.trim(), role, can_view_contact: canViewContact });
    },
    onSuccess: (r) => {
      onCreated({ label: r.gate_pass.label, secret: r.secret });
      setLabel("");
      setRole("SCANNER");
      setCanViewContact(false);
    },
    onError: (e) => setError(resolveApiErrorMessage(e)),
  });

  return (
    <Modal opened={opened} onClose={() => !create.isPending && onClose()} title="New gate pass" centered>
      <Stack gap="md">
        {error && (
          <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <TextInput label="Name" placeholder="Main Entrance" value={label} onChange={(e) => setLabel(e.currentTarget.value)} />
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            Role
          </Text>
          <SegmentedControl
            fullWidth
            value={role}
            onChange={(v) => setRole(v as "SCANNER" | "SUPERVISOR")}
            data={[
              { label: "Scanner (check-in only)", value: "SCANNER" },
              { label: "Supervisor (+ undo)", value: "SUPERVISOR" },
            ]}
          />
        </Stack>
        <Checkbox
          label="Allow this pass to see attendee contact details"
          checked={canViewContact}
          onChange={(e) => setCanViewContact(e.currentTarget.checked)}
        />
        <Button onClick={() => create.mutate()} loading={create.isPending}>
          Create pass
        </Button>
      </Stack>
    </Modal>
  );
}
