"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Accordion, Alert, Badge, Button, Card, Checkbox, Group, NumberInput, Select, SimpleGrid, Stack, Switch, Table, Text, TextInput, Textarea, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconAlertCircle, IconCheck, IconTicket } from "@tabler/icons-react";
import { updateComplimentaryProgram, type ComplimentaryProgram, type DeadlineMode } from "@/lib/complimentaryApi";
import type { Product } from "@/lib/productApi";
import { complimentaryInventory, optionRemaining, poolLineKey } from "@/lib/complimentaryInventory";

export function ComplimentarySettings({ eventId, initialProgram, products, disabled }: { eventId: number; initialProgram: ComplimentaryProgram; products: Product[]; disabled: boolean }) {
  const router = useRouter();
  const [program, setProgram] = useState(initialProgram);
  const [enabled, setEnabled] = useState(initialProgram.status === "ACTIVE");
  const [deadlineMode, setDeadlineMode] = useState<DeadlineMode>(initialProgram.deadline_mode);
  const [customDeadline, setCustomDeadline] = useState(initialProgram.custom_deadline_at?.slice(0, 16) ?? "");
  const [recipientLimit, setRecipientLimit] = useState(initialProgram.maximum_tickets_per_recipient);
  const [recipientMessage, setRecipientMessage] = useState(initialProgram.recipient_message ?? "");
  const [notifyAcceptance, setNotifyAcceptance] = useState(initialProgram.notify_on_distributor_acceptance);
  const [notifyEach, setNotifyEach] = useState(initialProgram.notify_on_each_issuance);
  const [notifyLow, setNotifyLow] = useState(initialProgram.notify_when_nearly_exhausted);
  const [notifyFailure, setNotifyFailure] = useState(initialProgram.notify_on_bulk_failure);
  const inventory = complimentaryInventory(products);
  const initialByItem = new Map(initialProgram.pool_lines.map((line) => [poolLineKey(line), line.quantity_reserved]));
  const [quantities, setQuantities] = useState<Record<string, number>>(() => Object.fromEntries(inventory.map((item) => [item.key, initialByItem.get(item.key) ?? 0])));
  const currentLine = new Map(program.pool_lines.map((line) => [poolLineKey(line), line]));
  const proposedChangeByProduct = new Map<number, number>();
  for (const item of inventory) {
    const oldReserve = currentLine.get(item.key)?.quantity_reserved ?? 0;
    const change = (quantities[item.key] ?? 0) - oldReserve;
    proposedChangeByProduct.set(item.productId, (proposedChangeByProduct.get(item.productId) ?? 0) + change);
  }
  // Same silent-clamp risk as the distributor-allocation modal: Mantine's
  // NumberInput snaps an out-of-range value to min/max on blur with no
  // visible diff. Block saving instead of trusting the clamp.
  const hasInvalidReserve = inventory.some((item) => {
    const line = currentLine.get(item.key);
    const minimum = (line?.quantity_issued_direct ?? 0) + (line?.quantity_issued_distributed ?? 0) + (line?.quantity_allocated ?? 0);
    const publicSalesPaused = item.product.disabled_at !== null || (item.option !== null && item.option.disabled_at !== null);
    const capacity = item.option?.quantity_available ?? item.product.quantity_available;
    const ceiling = publicSalesPaused ? (line?.quantity_reserved ?? 0) : capacity;
    const value = quantities[item.key] ?? 0;
    return value < minimum || (ceiling !== null && value > ceiling);
  });
  const save = useMutation({
    mutationFn: () => updateComplimentaryProgram(eventId, { status: enabled ? "ACTIVE" : "DISABLED", deadline_mode: deadlineMode, custom_deadline_at: deadlineMode === "CUSTOM" ? new Date(customDeadline).toISOString() : null, maximum_tickets_per_recipient: recipientLimit, notify_on_distributor_acceptance: notifyAcceptance, notify_on_each_issuance: notifyEach, notify_when_nearly_exhausted: notifyLow, notify_on_bulk_failure: notifyFailure, recipient_message: recipientMessage.trim() || null, lines: inventory.map((item) => ({ product_id: item.productId, product_price_tier_id: item.optionId, quantity_reserved: quantities[item.key] ?? 0 })) }),
    onSuccess: ({ program: updated }) => {
      setProgram(updated);
      // `products` is a server-rendered snapshot passed down as a prop —
      // without this, `quantity_remaining` stays stale after a save, so
      // "Public availability after save" briefly shows a wrong number
      // (reverts to the pre-save figure) until the next full page load.
      router.refresh();
      notifications.show({ color: "teal", icon: <IconCheck size={16} />, message: "Complimentary settings saved." });
    },
    onError: (error: Error) => notifications.show({ color: "red", message: error.message }),
  });
  if (products.length === 0) return <Card withBorder radius="lg" p="xl"><Stack align="flex-start"><IconTicket size={28} /><Title order={4}>Create a ticket type first</Title><Text c="dimmed">Complimentary tickets use the same ticket types and capacity as public tickets. Create Regular, VIP, VVIP, or another ticket type before reserving complimentary capacity.</Text><Button component={Link} href={`/events/${eventId}/settings?tab=ticket-setup`}>Create ticket type</Button></Stack></Card>;

  return <Card withBorder radius="lg" p="xl"><fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}><Stack gap="lg">
    <Group justify="space-between" align="flex-start"><Stack gap={2}><Title order={4}>Complimentary ticket settings</Title><Text size="sm" c="dimmed">Reserve capacity from existing ticket types. Operational issuance and distributors remain in the Complimentary workspace.</Text></Stack><Switch label="Enable complimentary tickets" checked={enabled} onChange={(e) => { const checked = e.currentTarget.checked; if (checked) return setEnabled(true); modals.openConfirmModal({ title: "Pause complimentary ticketing?", children: <Stack gap="xs"><Text size="sm">New direct and distributor ticket issuance will be paused. Existing tickets remain valid.</Text><Text size="sm" c="dimmed">Your reserved ticket quantities will not change. You can adjust them separately in these settings.</Text></Stack>, labels: { confirm: "Pause complimentary ticketing", cancel: "Keep enabled" }, confirmProps: { color: "orange" }, onConfirm: () => setEnabled(false) }); }} /></Group>
    {!enabled && <Alert color="blue" icon={<IconAlertCircle size={18} />}>Enable this feature and reserve at least one ticket before using complimentary operations.</Alert>}
    <Table.ScrollContainer minWidth={760}><Table verticalSpacing="sm"><Table.Thead><Table.Tr><Table.Th>Ticket / option</Table.Th><Table.Th>Option capacity</Table.Th><Table.Th>Currently reserved</Table.Th><Table.Th>New reserve</Table.Th><Table.Th>Public availability after save</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{inventory.map((item) => { const line = currentLine.get(item.key); const oldReserve = line?.quantity_reserved ?? 0; const newReserve = quantities[item.key] ?? 0; const ownChange = newReserve - oldReserve; const groupChange = proposedChangeByProduct.get(item.productId) ?? 0; const optionAfter = item.option ? Math.max(0, optionRemaining(item.option) - ownChange) : null; const groupAfter = item.product.quantity_remaining === null ? null : Math.max(0, Number(item.product.quantity_remaining ?? 0) - groupChange); const publicAfter = item.option ? (groupAfter === null ? optionAfter : Math.min(optionAfter ?? 0, groupAfter)) : groupAfter; const minimum = (line?.quantity_issued_direct ?? 0) + (line?.quantity_issued_distributed ?? 0) + (line?.quantity_allocated ?? 0); const publicSalesPaused = item.product.disabled_at !== null || (item.option !== null && item.option.disabled_at !== null); const capacity = item.option?.quantity_available ?? item.product.quantity_available; const ceiling = publicSalesPaused ? oldReserve : capacity; const reserveError = newReserve < minimum ? `Cannot go below ${minimum} already committed` : (ceiling !== null && newReserve > ceiling ? (publicSalesPaused ? `Public sales are paused; reserve is locked at ${oldReserve}` : `Exceeds available capacity (${ceiling})`) : undefined); return <Table.Tr key={item.key}><Table.Td><Group gap="xs"><Text fw={600}>{item.label}</Text>{publicSalesPaused && <Badge color="gray" variant="light">Public sales paused</Badge>}</Group>{item.option && <Text size="xs" c="dimmed">Part of {item.product.title}&apos;s shared {item.product.quantity_available ?? "unlimited"} capacity</Text>}{publicSalesPaused && <Text size="xs" c="dimmed">Existing complimentary reserve remains usable.</Text>}</Table.Td><Table.Td>{capacity ?? "Unlimited"}</Table.Td><Table.Td>{oldReserve}</Table.Td><Table.Td><NumberInput aria-label={`Complimentary reserve for ${item.label}`} min={minimum} max={ceiling ?? undefined} clampBehavior="blur" error={reserveError} value={newReserve} onChange={(value) => setQuantities((current) => ({ ...current, [item.key]: Number(value) || 0 }))} /></Table.Td><Table.Td><Text fw={600} c={publicAfter !== null && publicAfter === 0 ? "orange" : undefined}>{publicAfter ?? "Unlimited"}</Text></Table.Td></Table.Tr>; })}</Table.Tbody></Table></Table.ScrollContainer>
    <Text size="xs" c="dimmed">Increasing the reserve immediately reduces public availability. Reducing it releases unused capacity back to public sale.</Text>
    <Accordion variant="contained"><Accordion.Item value="advanced"><Accordion.Control>Advanced settings</Accordion.Control><Accordion.Panel><Stack><SimpleGrid cols={{ base: 1, sm: 2 }}><Select label="Distribution deadline" value={deadlineMode} onChange={(value) => setDeadlineMode((value ?? "EVENT_START") as DeadlineMode)} data={[{ value: "EVENT_START", label: "At event start" }, { value: "EVENT_END", label: "At event end" }, { value: "CUSTOM", label: "Custom date and time" }]} />{deadlineMode === "CUSTOM" && <TextInput required type="datetime-local" label="Custom deadline" value={customDeadline} onChange={(e) => setCustomDeadline(e.currentTarget.value)} />}<NumberInput label="Maximum tickets per recipient per operation" min={1} max={50} value={recipientLimit} onChange={(value) => setRecipientLimit(Number(value) || 10)} /></SimpleGrid><Checkbox label="Notify when a distributor accepts" checked={notifyAcceptance} onChange={(e) => setNotifyAcceptance(e.currentTarget.checked)} /><Checkbox label="Notify on every issuance" checked={notifyEach} onChange={(e) => setNotifyEach(e.currentTarget.checked)} /><Checkbox label="Notify when an allocation is nearly exhausted" checked={notifyLow} onChange={(e) => setNotifyLow(e.currentTarget.checked)} /><Checkbox label="Notify when a bulk distribution fails" checked={notifyFailure} onChange={(e) => setNotifyFailure(e.currentTarget.checked)} /><Textarea label="Optional recipient message" maxLength={1000} value={recipientMessage} onChange={(e) => setRecipientMessage(e.currentTarget.value)} /></Stack></Accordion.Panel></Accordion.Item></Accordion>
    <Group justify="space-between"><Button component={Link} href={`/events/${eventId}/complimentary`} variant="subtle">Open complimentary operations</Button><Button loading={save.isPending} disabled={hasInvalidReserve} onClick={() => { if (deadlineMode === "CUSTOM" && !customDeadline) notifications.show({ color: "red", message: "Choose a custom deadline." }); else if (hasInvalidReserve) notifications.show({ color: "red", message: "Fix the highlighted reserve quantities before saving." }); else save.mutate(); }}>Save complimentary settings</Button></Group>
  </Stack></fieldset></Card>;
}
