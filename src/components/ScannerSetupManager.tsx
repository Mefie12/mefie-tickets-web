"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionIcon, Alert, Badge, Button, Card, CopyButton, Group, Image, List, Modal, Select, Stack, Table, Text, TextInput, Title, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconRefresh, IconTrash } from "@tabler/icons-react";
import type { EventGate } from "@/lib/gateRoutingApi";
import { GateConfigStatus } from "@/components/GateConfigStatus";
import { TableScrollShadow } from "@/components/TableScrollShadow";
import {
  createScannerSetup,
  listScannerSetups,
  regenerateScannerSetupLink,
  revokeScannerSetup,
  scannerSetupLabel,
  sendNewScannerSetupCode,
  type ScannerSetup,
} from "@/lib/scannerSetupApi";
import { addIssuedLink, dismissIssuedLink, type IssuedLink } from "@/lib/issuedScannerLinks";

const SETUP_BADGE: Record<ScannerSetup["setup_status"], string> = {
  AVAILABLE: "blue",
  CONSUMED: "teal",
  REVOKED: "gray",
  EXPIRED: "orange",
  EVENT_CLOSED: "gray",
};

/** "expires in 11m" / "expired" from an ISO timestamp. */
function expiryLabel(iso: string | null): string {
  if (!iso) return "";
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  return minutes > 0 ? `expires in ${minutes}m` : "expired";
}

function activationLabel(setup: ScannerSetup): string {
  if (setup.setup_status === "CONSUMED" || setup.code.status === "CONSUMED") return "Activated";
  if (setup.code.send_status === "SEND_FAILED") return "Send failed";
  switch (setup.code.status) {
    case "ACTIVE": return `Code ${expiryLabel(setup.code.expires_at)}`;
    case "EXPIRED": return "Code expired";
    case "LOCKED": return "Locked";
    default: return "—";
  }
}

export function ScannerSetupManager({
  eventId,
  eventStatus,
  gates,
  structureChanges,
  initialSetups,
}: {
  eventId: number;
  eventStatus: string;
  gates: EventGate[];
  structureChanges: { allowed: boolean; reason: string | null };
  initialSetups?: ScannerSetup[];
}) {
  const queryClient = useQueryClient();

  const availableGates = useMemo(() => gates
    .filter((item) => item.status === "ACTIVE")
    .map((item) => ({ ...item, lanes: item.lanes.filter((lane) => lane.status === "ACTIVE") }))
    .filter((item) => item.lanes.length > 0), [gates]);
  const unpublishedCount = gates.reduce((count, item) => count + (item.status !== "ACTIVE" ? 1 : 0)
    + item.lanes.filter((lane) => lane.status !== "ACTIVE").length, 0);

  const gateName = useMemo(() => new Map(gates.map((g) => [g.id, g.name])), [gates]);
  const laneName = useMemo(() => new Map(gates.flatMap((g) => g.lanes).map((l) => [l.id, l.name])), [gates]);

  const [gateId, setGateId] = useState(String(availableGates[0]?.id ?? ""));
  const gate = useMemo(() => availableGates.find((item) => String(item.id) === gateId), [availableGates, gateId]);
  const [laneId, setLaneId] = useState(String(gate?.lanes[0]?.id ?? ""));
  const [role, setRole] = useState<"SCANNER" | "SUPERVISOR">("SCANNER");
  const [label, setLabel] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  // Every freshly issued link/QR stays on screen until dismissed — creating another scanner must not erase it.
  const [issuedLinks, setIssuedLinks] = useState<IssuedLink[]>([]);
  const [error, setError] = useState<string>();
  const [confirmFirstScanner, setConfirmFirstScanner] = useState(false);
  // The gate config lock is server-computed and delivered at page load;
  // reflect the freeze the first Create causes without a full reload.
  const [locallyLocked, setLocallyLocked] = useState(false);

  const setups = useQuery({
    queryKey: ["scanner-setups", eventId],
    queryFn: () => listScannerSetups(eventId),
    initialData: initialSetups,
    refetchInterval: 30_000,
  });

  const chooseGate = (value: string | null) => {
    const next = availableGates.find((item) => String(item.id) === value);
    setGateId(value ?? "");
    setLaneId(String(next?.lanes[0]?.id ?? ""));
  };

  const create = useMutation({
    mutationFn: () => createScannerSetup(eventId, {
      event_gate_id: Number(gateId),
      gate_lane_id: Number(laneId),
      role,
      recipient_email: recipientEmail.trim(),
      recipient_name: recipientName.trim() || undefined,
      device_label: label.trim() || undefined,
    }),
    onSuccess: (result) => {
      setIssuedLinks((links) => addIssuedLink(links, {
        setupId: result.scanner_setup.id,
        heading: `Scanner setup created${result.scanner_setup.device_label ? ` · ${result.scanner_setup.device_label}` : ""}`,
        message: result.code_send_status === "SEND_FAILED"
          ? `We couldn't send the activation email to ${result.recipient_email}. Use "Send new code" on the row below to retry.`
          : `Activation code emailed to ${result.recipient_email}. Show this QR (or send the link) to the device — it's inert without the code.`,
        failed: result.code_send_status === "SEND_FAILED",
        url: result.setup_url,
        qr: result.setup_qr,
      }));
      setError(undefined);
      setLabel("");
      setRecipientEmail("");
      setRecipientName("");
      setLocallyLocked(true);
      queryClient.invalidateQueries({ queryKey: ["scanner-setups", eventId] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Unable to create setup link."),
  });

  // These used to fail silently (a resend cooldown or send limit just did nothing).
  const failure = (fallback: string) => (e: unknown) =>
    notifications.show({ color: "red", message: e instanceof Error && e.message ? e.message : fallback });

  const resend = useMutation({
    mutationFn: (setupId: string) => sendNewScannerSetupCode(eventId, setupId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["scanner-setups", eventId] });
      notifications.show(result.code_send_status === "SEND_FAILED"
        ? { color: "red", message: "We couldn't send the email. Check the address and try again." }
        : { color: "teal", message: "A new activation code was emailed." });
    },
    onError: failure("Could not send a new code."),
  });

  const revoke = useMutation({
    mutationFn: (setupId: string) => revokeScannerSetup(eventId, setupId),
    onSuccess: (_result, setupId) => {
      setIssuedLinks((links) => dismissIssuedLink(links, setupId));
      queryClient.invalidateQueries({ queryKey: ["scanner-setups", eventId] });
    },
    onError: failure("Could not revoke this setup."),
  });

  const regenerate = useMutation({
    mutationFn: (setupId: string) => regenerateScannerSetupLink(eventId, setupId),
    onSuccess: (result, setupId) => {
      const setup = (setups.data ?? []).find((row) => row.id === setupId);
      setIssuedLinks((links) => addIssuedLink(links, {
        setupId,
        heading: `New link${setup?.device_label ? ` · ${setup.device_label}` : ""}`,
        message: "The previous link and QR for this scanner no longer work. Show this QR or send this link instead.",
        failed: false,
        url: result.setup_url,
        qr: result.setup_qr,
      }));
    },
    onError: failure("Could not create a new link."),
  });

  const confirmRevoke = (setup: ScannerSetup) => {
    if (window.confirm(`Revoke this setup link${setup.recipient_email ? ` for ${setup.recipient_email}` : ""}? The device will not be able to enroll with it.`)) {
      revoke.mutate(setup.id);
    }
  };
  const confirmRegenerate = (setup: ScannerSetup) => {
    if (window.confirm("Create a new link and QR for this scanner? The current ones will stop working.")) {
      regenerate.mutate(setup.id);
    }
  };

  const rows = setups.data ?? [];
  const structureLocked = !structureChanges.allowed || locallyLocked;
  // The first scanner setup on a live event is what freezes the entrance/
  // lane structure — warn once, at that action.
  const willFreezeStructure = eventStatus === "LIVE" && structureChanges.allowed && !locallyLocked && rows.length === 0;

  const submitCreate = () => {
    if (willFreezeStructure) { setConfirmFirstScanner(true); return; }
    create.mutate();
  };

  return <Stack maw={920}>
    <div><Title order={2}>Scanner setup</Title><Text c="dimmed">Create one setup link per device and email its activation code to the person who will run it. Track and revoke them here.</Text></div>

    <GateConfigStatus locked={structureLocked} reason={structureChanges.reason} eventStatus={eventStatus} />

    {unpublishedCount > 0 && <Alert color="orange" title="Unpublished entrances or lanes are excluded">
      Route a ticket type to the new entrance or lane and publish that routing change before assigning a scanner to it.
      <Button component="a" href={`/events/${eventId}/gates#ticket-routing`} variant="subtle" size="xs" mt="xs">Open ticket routing</Button>
    </Alert>}
    {availableGates.length === 0 && <Alert color="blue" title="No scanner-ready entrance">
      Publish at least one entrance and lane before creating a scanner setup.
    </Alert>}

    <Card withBorder><Stack>
      <Text fw={600}>Add scanner</Text>
      <Select label="Entrance" value={gateId} onChange={chooseGate} data={availableGates.map((item) => ({ value: String(item.id), label: item.name }))} />
      <Select label="Lane" value={laneId} onChange={(value) => setLaneId(value ?? "")} data={(gate?.lanes ?? []).map((item) => ({ value: String(item.id), label: item.name }))} />
      <Select label="Role" value={role} onChange={(value) => setRole(value as "SCANNER" | "SUPERVISOR")} data={[{ value: "SCANNER", label: "Scanner" }, { value: "SUPERVISOR", label: "Supervisor (can reverse admissions)" }]} />
      <TextInput
        label="Recipient email"
        required
        type="email"
        value={recipientEmail}
        onChange={(event) => setRecipientEmail(event.currentTarget.value)}
        placeholder="volunteer@example.com"
        description="We'll email the 6-digit activation code here. The link is inert without it."
      />
      <TextInput label="Recipient name (optional)" value={recipientName} onChange={(event) => setRecipientName(event.currentTarget.value)} placeholder="Ama Mensah" />
      <TextInput label="Device label (optional)" value={label} onChange={(event) => setLabel(event.currentTarget.value)} placeholder="Samsung A15 #4" />
      <Button
        onClick={submitCreate}
        loading={create.isPending}
        disabled={!gateId || !laneId || !recipientEmail.trim()}
      >
        Create scanner
      </Button>
    </Stack></Card>

    <Modal
      opened={confirmFirstScanner}
      onClose={() => setConfirmFirstScanner(false)}
      title="Prepare scanner?"
      centered
    >
      <Stack>
        <Text size="sm">
          Preparing the first scanner locks your entrance and lane setup for this event.
        </Text>
        <Text size="sm" fw={600}>Before continuing, make sure:</Text>
        <List size="sm" spacing={4}>
          <List.Item>All entrances have been created</List.Item>
          <List.Item>All lanes have been created</List.Item>
          <List.Item>Ticket types are routed to the correct entrance and lane</List.Item>
        </List>
        <Text size="sm" c="dimmed">
          You can still add more scanner devices to existing lanes after preparation. To change the
          structure later you&apos;d need to revoke every scanner setup first.
        </Text>
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={() => setConfirmFirstScanner(false)}>Cancel</Button>
          <Button
            loading={create.isPending}
            onClick={() => { setConfirmFirstScanner(false); create.mutate(); }}
          >
            Prepare scanner
          </Button>
        </Group>
      </Stack>
    </Modal>

    {error && <Alert color="red">{error}</Alert>}
    {issuedLinks.map((link) => <Alert key={link.setupId} color={link.failed ? "red" : "blue"} title={link.heading}
      withCloseButton closeButtonLabel="Dismiss" onClose={() => setIssuedLinks((links) => dismissIssuedLink(links, link.setupId))}>
      <Text size="sm">{link.message}</Text>
      <Group mt="sm" align="flex-start" gap="lg">
        <Image src={link.qr} alt="Scanner setup QR" w={160} h={160} />
        <Stack gap="xs" style={{ flex: 1, minWidth: 220 }}>
          <Text size="xs" c="dimmed" style={{ wordBreak: "break-all" }}>{link.url}</Text>
          <CopyButton value={link.url}>{({ copy, copied }) => <Button size="xs" variant="light" onClick={copy}>{copied ? "Copied" : "Copy setup link"}</Button>}</CopyButton>
          <Text size="xs" c="dimmed">This link is shown only now. Lost it later? Use &quot;New link&quot; on the scanner&apos;s row.</Text>
        </Stack>
      </Group>
    </Alert>)}

    <Card withBorder>
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Configured scanners</Text>
        {setups.isFetching && <Text size="xs" c="dimmed">Refreshing…</Text>}
      </Group>
      {rows.length === 0
        ? <Text size="sm" c="dimmed">No scanner setups yet. Create one above.</Text>
        : <TableScrollShadow minWidth={760}><Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead><Table.Tr>
            <Table.Th>Setup</Table.Th><Table.Th>Assignment</Table.Th><Table.Th>Recipient</Table.Th><Table.Th>Activation</Table.Th><Table.Th>Created</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>{rows.map((setup) => {
            const canManageCode = setup.setup_status === "AVAILABLE";
            return <Table.Tr key={setup.id}>
              <Table.Td>
                <Badge variant="light" color={SETUP_BADGE[setup.setup_status]}>{scannerSetupLabel(setup.setup_status)}</Badge>
                {setup.device_label && <Text size="xs" c="dimmed">{setup.device_label}</Text>}
              </Table.Td>
              <Table.Td>
                <Text size="sm">{gateName.get(setup.event_gate_id) ?? `Gate ${setup.event_gate_id}`}</Text>
                <Text size="xs" c="dimmed">{laneName.get(setup.gate_lane_id) ?? `Lane ${setup.gate_lane_id}`} · {setup.role === "SUPERVISOR" ? "Supervisor" : "Scanner"}</Text>
              </Table.Td>
              <Table.Td><Text size="sm">{setup.recipient_email ?? <Text span c="dimmed">—</Text>}</Text></Table.Td>
              <Table.Td>
                <Text size="sm">{activationLabel(setup)}</Text>
                {canManageCode && setup.code.status !== "CONSUMED" && (
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    mt={4}
                    loading={resend.isPending && resend.variables === setup.id}
                    onClick={() => resend.mutate(setup.id)}
                  >
                    Send new code
                  </Button>
                )}
              </Table.Td>
              <Table.Td><Text size="xs" c="dimmed">{new Date(setup.created_at).toLocaleString()}</Text></Table.Td>
              <Table.Td ta="right">
                {canManageCode && (
                  <Group gap={4} justify="flex-end" wrap="nowrap">
                    <Tooltip label="Show a new link and QR (the current ones stop working)">
                      <ActionIcon
                        variant="subtle"
                        aria-label="New link and QR"
                        loading={regenerate.isPending && regenerate.variables === setup.id}
                        onClick={() => confirmRegenerate(setup)}
                      >
                        <IconRefresh size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Revoke this setup">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label="Revoke setup"
                        loading={revoke.isPending && revoke.variables === setup.id}
                        onClick={() => confirmRevoke(setup)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                )}
              </Table.Td>
            </Table.Tr>;
          })}</Table.Tbody>
        </Table></TableScrollShadow>}
      <Text size="xs" c="dimmed" mt="sm">
        The setup link stays valid for the whole event — only the activation code expires (resend it above).
        Once a device has enrolled, its link is spent: to cut that device off, use{" "}
        <Text span component="a" href={`/events/${eventId}/gate-operations`} c="blue">Gate operations</Text>.
        To move an already-enrolled device to a different entrance or lane, don&apos;t retire it there first —
        create a new scanner setup above for the correct entrance and lane and re-enroll the same device with it.
        Reassigning it this way automatically retires its old assignment, but only once it has no pending
        offline check-ins and has synced recently; otherwise the new setup will refuse to activate until it does.
      </Text>
    </Card>
  </Stack>;
}
