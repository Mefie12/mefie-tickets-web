"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Checkbox, Group, Select, SimpleGrid, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconAlertCircle, IconCheck, IconPlus, IconTicket, IconTrash } from "@tabler/icons-react";
import { isValidPhoneNumber } from "libphonenumber-js";
import type { AnswerValue } from "@/lib/checkoutApi";
import { issueComplimentaryTickets, listDirectComplimentaryIssues, type ComplimentaryProgram, type DirectComplimentaryIssue } from "@/lib/complimentaryApi";
import type { Product } from "@/lib/productApi";
import type { Question } from "@/lib/questionApi";
import { ApiError } from "@/lib/authApi";
import { EditableQuestionField, isQuestionAnswered } from "@/components/EditableQuestionField";
import { PhoneInput } from "@/components/PhoneInput";
import { ComplimentaryDistributorManager } from "@/components/ComplimentaryDistributorManager";
import { complimentaryInventory, poolLineKey } from "@/lib/complimentaryInventory";

type AttendeeDraft = { inventory_key: string; first_name: string; last_name: string; email: string; phone: string; answers: Record<number, AnswerValue> };
type IssueSuccess = { id: number; shortId: string; count: number; emailed: boolean; summary: Array<{ label: string; quantity: number }> };
const emptyAttendee = (): AttendeeDraft => ({ inventory_key: "", first_name: "", last_name: "", email: "", phone: "", answers: {} });

export function ComplimentaryTicketsManager({ eventId, initialProgram, products, questions }: { eventId: number; initialProgram: ComplimentaryProgram; products: Product[]; questions: Question[] }) {
  const queryClient = useQueryClient();
  const [program, setProgram] = useState(initialProgram);
  const [attendees, setAttendees] = useState<AttendeeDraft[]>([emptyAttendee()]);
  const [emailTickets, setEmailTickets] = useState(true);
  const [success, setSuccess] = useState<IssueSuccess | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loadedAt] = useState(() => Date.now());
  const issuanceKey = useRef(crypto.randomUUID());
  const attendeeQuestions = useMemo(() => questions.filter((q) => q.scope === "ATTENDEE").sort((a, b) => a.sort_order - b.sort_order), [questions]);
  const inventory = complimentaryInventory(products);
  const itemByKey = new Map(inventory.map((item) => [item.key, item]));
  const lineByItem = new Map(program.pool_lines.map((line) => [poolLineKey(line), line]));
  const recentIssues = useQuery({
    queryKey: ["direct-complimentary-issues", eventId],
    queryFn: () => listDirectComplimentaryIssues(eventId),
    refetchInterval: (query) => query.state.data?.some((order) => ["EMAIL_QUEUED", "WAITING_FOR_WORKER", "SENT"].includes(order.delivery_summary_status)) ? 5000 : false,
  });
  const selectedCounts = new Map<string, number>();
  for (const attendee of attendees) if (attendee.inventory_key) selectedCounts.set(attendee.inventory_key, (selectedCounts.get(attendee.inventory_key) ?? 0) + 1);
  const issueSummary = Array.from(selectedCounts.entries()).map(([key, quantity]) => ({ key, quantity, item: itemByKey.get(key)!, available: lineByItem.get(key)?.quantity_available ?? 0 }));
  const capacityExceeded = issueSummary.some((row) => row.quantity > row.available);
  const deadlinePassed = program.issuance_deadline_at !== null && new Date(program.issuance_deadline_at).getTime() <= loadedAt;
  const refreshProgram = () => fetch(`/api/events/${eventId}/complimentary-program`).then((r) => r.json()).then((data) => data.program && setProgram(data.program));

  const issueMutation = useMutation({
    mutationFn: () => issueComplimentaryTickets(eventId, {
      idempotency_key: issuanceKey.current,
      email_tickets: emailTickets,
      attendees: attendees.map((attendee) => ({
        product_id: itemByKey.get(attendee.inventory_key)!.productId,
        product_price_tier_id: itemByKey.get(attendee.inventory_key)!.optionId,
        first_name: attendee.first_name.trim(), last_name: attendee.last_name.trim(),
        email: attendee.email.trim(), phone: attendee.phone.trim() || null,
        answers: attendeeQuestions.filter((question) => question.is_required || isQuestionAnswered({ ...question, is_required: true }, attendee.answers[question.id])).map((question) => ({ question_id: question.id, answer: attendee.answers[question.id] ?? "" })),
      })),
    }),
    onSuccess: ({ order }) => {
      notifications.show({ color: "teal", icon: <IconCheck size={16} />, message: `Complimentary tickets issued (${order.short_id}).` });
      setSuccess({ id: order.id, shortId: order.short_id, count: attendees.length, emailed: emailTickets, summary: issueSummary.map((row) => ({ label: row.item.label, quantity: row.quantity })) });
      setFieldErrors({});
      issuanceKey.current = crypto.randomUUID();
      setAttendees([emptyAttendee()]);
      refreshProgram();
      queryClient.invalidateQueries({ queryKey: ["direct-complimentary-issues", eventId] });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError) setFieldErrors(Object.fromEntries(Object.entries(error.errors ?? {}).map(([key, messages]) => [key, messages[0]])));
      showError(error);
      refreshProgram();
    },
  });

  function validateIssue(): string | null {
    if (program.status !== "ACTIVE") return "Enable and save complimentary tickets before issuing.";
    if (deadlinePassed) return "The complimentary issuance deadline has passed. Existing tickets remain valid.";
    if (attendees.length > 50) return "You can issue up to 50 tickets in one operation.";
    const perEmail = new Map<string, number>();
    for (const [index, attendee] of attendees.entries()) {
      if (!attendee.inventory_key) return `Choose a ticket option for attendee ${index + 1}.`;
      if (!attendee.first_name.trim() || !attendee.last_name.trim()) return `Enter the full name for attendee ${index + 1}.`;
      if (!/^\S+@\S+\.\S+$/.test(attendee.email)) return `Enter a valid email for attendee ${index + 1}.`;
      if (attendee.phone && !isValidPhoneNumber(attendee.phone)) return `Enter a valid phone number for attendee ${index + 1}, or leave it blank.`;
      const email = attendee.email.trim().toLowerCase();
      perEmail.set(email, (perEmail.get(email) ?? 0) + 1);
      for (const question of attendeeQuestions) if (!isQuestionAnswered(question, attendee.answers[question.id])) return `'${question.title}' is required for every attendee.`;
    }
    if (Math.max(...perEmail.values()) > program.maximum_tickets_per_recipient) return `A recipient may receive at most ${program.maximum_tickets_per_recipient} tickets in one issuance.`;
    if (capacityExceeded) return "One or more ticket options do not have enough complimentary capacity.";
    return null;
  }

  function submitIssue() {
    const error = validateIssue();
    if (error) return notifications.show({ color: "red", message: error });
    setFieldErrors({});
    if (attendees.length === 1) return issueMutation.mutate();
    modals.openConfirmModal({
      title: `Issue ${attendees.length} complimentary tickets?`,
      children: <Stack gap="xs">{issueSummary.map((row) => <Text size="sm" key={row.key}>{row.quantity} × {row.item.label}</Text>)}<Text size="sm" c="dimmed">{emailTickets ? `Email delivery will be queued for ${attendees.length} attendee${attendees.length === 1 ? "" : "s"}.` : "No ticket emails will be sent."}</Text></Stack>,
      labels: { confirm: `Issue ${attendees.length} tickets`, cancel: "Review" },
      onConfirm: () => issueMutation.mutate(),
    });
  }

  function patchAttendee(index: number, patch: Partial<AttendeeDraft>) { setAttendees((current) => current.map((a, i) => i === index ? { ...a, ...patch } : a)); }

  const totalReserved = program.pool_lines.reduce((sum, line) => sum + line.quantity_reserved, 0);
  const totalAvailable = program.pool_lines.reduce((sum, line) => sum + line.quantity_available, 0);

  return <Stack gap="xl">
    <Stack gap={4}><Group justify="space-between"><Stack gap={2}><Title order={3}>Complimentary operations</Title><Text c="dimmed">Issue tickets and manage distributor allocations.</Text></Stack><Badge color={program.status === "ACTIVE" ? "teal" : "gray"}>{program.status}</Badge></Group></Stack>

    <Card withBorder radius="lg" p="lg"><Group justify="space-between" align="center"><Group gap="xl"><Stack gap={0}><Text size="xs" c="dimmed">Reserved capacity</Text><Text fw={700} fz="xl">{totalReserved}</Text></Stack><Stack gap={0}><Text size="xs" c="dimmed">Unallocated balance</Text><Text fw={700} fz="xl">{totalAvailable}</Text></Stack></Group><Button component={Link} href={`/events/${eventId}/settings?tab=complimentary`} variant="light">Manage settings</Button></Group></Card>

    {products.length === 0 && <Alert icon={<IconAlertCircle size={18} />} color="blue" title="Ticket setup required">Create at least one ticket type before using complimentary operations. <Button component={Link} href={`/events/${eventId}/settings?tab=ticket-setup`} variant="subtle" size="xs">Create ticket type</Button></Alert>}
    {products.length > 0 && program.status !== "ACTIVE" && <Alert icon={<IconAlertCircle size={18} />} color="yellow" title="Complimentary tickets are not active">Enable the feature and reserve capacity in Event Settings. <Button component={Link} href={`/events/${eventId}/settings?tab=complimentary`} variant="subtle" size="xs">Open settings</Button></Alert>}

    {products.length > 0 && <>
    {success && <Alert color="teal" icon={<IconCheck size={18} />} title={`${success.count} complimentary ticket${success.count === 1 ? "" : "s"} issued`}>
      <Stack gap="xs"><Text size="sm">Order {success.shortId}</Text>{success.summary.map((row) => <Text size="sm" key={row.label}>{row.quantity} × {row.label}</Text>)}<Text size="sm">{success.emailed ? "Email delivery has been queued." : "No ticket emails were sent."}</Text><Group><Button component={Link} href={`/events/${eventId}/orders/${success.id}`} size="xs" variant="light">View order</Button><Button size="xs" variant="subtle" onClick={() => setSuccess(null)}>Issue more tickets</Button></Group></Stack>
    </Alert>}
    <Card withBorder radius="lg" p="lg"><Stack gap="lg">
      <Stack gap={2}><Group><IconTicket size={20} /><Text fw={700}>Issue directly to attendees</Text></Group><Text size="sm" c="dimmed">Add one attendee for each ticket you want to issue. Each attendee receives one individual ticket and QR code. You can issue up to 50 tickets at once.</Text></Stack>
      {program.status !== "ACTIVE" && <Alert icon={<IconAlertCircle size={18} />} color="yellow">Enable and save the complimentary program before issuing tickets.</Alert>}
      {deadlinePassed && <Alert icon={<IconAlertCircle size={18} />} color="orange">The complimentary issuance deadline has passed. New tickets cannot be issued, but existing tickets remain valid.</Alert>}
      {attendees.map((attendee, index) => <Card key={index} withBorder radius="md" p="md"><Stack>
        <Group justify="space-between"><Text fw={600}>Attendee {index + 1} · 1 ticket</Text>{attendees.length > 1 && <Button variant="subtle" color="red" size="compact-sm" leftSection={<IconTrash size={14} />} onClick={() => setAttendees((a) => a.filter((_, i) => i !== index))}>Remove</Button>}</Group>
        <Select required searchable label="Ticket / option" placeholder="Choose a ticket" error={fieldErrors[`attendees.${index}.product_price_tier_id`] ?? fieldErrors[`attendees.${index}.product_id`]} data={inventory.map((item) => { const available = lineByItem.get(item.key)?.quantity_available ?? 0; return { value: item.key, disabled: available === 0, label: `${item.label}${item.product.disabled_at || item.option?.disabled_at ? " · Public sales paused" : ""} · ${available > 0 ? `${available} available` : "No complimentary balance"}` }; })} value={attendee.inventory_key} onChange={(v) => patchAttendee(index, { inventory_key: v ?? "" })} />
        <SimpleGrid cols={{ base: 1, sm: 2 }}><TextInput required label="First name" error={fieldErrors[`attendees.${index}.first_name`]} value={attendee.first_name} onChange={(e) => patchAttendee(index, { first_name: e.currentTarget.value })} /><TextInput required label="Last name" error={fieldErrors[`attendees.${index}.last_name`]} value={attendee.last_name} onChange={(e) => patchAttendee(index, { last_name: e.currentTarget.value })} /><TextInput required type="email" label="Email" error={fieldErrors[`attendees.${index}.email`]} value={attendee.email} onChange={(e) => patchAttendee(index, { email: e.currentTarget.value })} /><PhoneInput label="Phone (optional)" value={attendee.phone} onChange={(phone) => patchAttendee(index, { phone })} /></SimpleGrid>
        {attendeeQuestions.map((question) => <EditableQuestionField key={question.id} question={question} value={attendee.answers[question.id]} onChange={(answer) => patchAttendee(index, { answers: { ...attendee.answers, [question.id]: answer } })} />)}
      </Stack></Card>)}
      {issueSummary.length > 0 && <Card withBorder radius="md" p={0}><Stack gap={0}><Group justify="space-between" px="md" py="sm"><Stack gap={0}><Text fw={600} size="sm">Issuance summary</Text><Text size="xs" c="dimmed">Review how this issuance will use the complimentary balance.</Text></Stack><Badge variant="light" color={capacityExceeded ? "orange" : "gray"}>{attendees.length} ticket{attendees.length === 1 ? "" : "s"}</Badge></Group><Table.ScrollContainer minWidth={560}><Table verticalSpacing="xs" horizontalSpacing="md"><Table.Thead><Table.Tr><Table.Th>Ticket / option</Table.Th><Table.Th ta="right">Issuing</Table.Th><Table.Th ta="right">Available</Table.Th><Table.Th ta="right">After issuance</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{issueSummary.map((row) => { const exceeded = row.quantity > row.available; return <Table.Tr key={row.key}><Table.Td><Text size="sm" fw={500}>{row.item.label}</Text></Table.Td><Table.Td ta="right"><Badge variant="light" color={exceeded ? "orange" : "blue"}>{row.quantity}</Badge></Table.Td><Table.Td ta="right"><Text size="sm" c="dimmed">{row.available}</Text></Table.Td><Table.Td ta="right"><Text size="sm" fw={500} c={exceeded ? "orange" : undefined}>{Math.max(0, row.available - row.quantity)}</Text></Table.Td></Table.Tr>; })}</Table.Tbody></Table></Table.ScrollContainer>{capacityExceeded && <Alert m="md" mt="xs" color="orange" variant="light" icon={<IconAlertCircle size={16} />}>Reduce the attendees assigned to an option that exceeds its available complimentary balance.</Alert>}</Stack></Card>}
      <Group justify="space-between"><Button variant="light" leftSection={<IconPlus size={16} />} disabled={attendees.length >= 50} onClick={() => setAttendees((a) => [...a, emptyAttendee()])}>Add attendee</Button><Checkbox label="Email each attendee their ticket after issuance" description={!emailTickets ? "Tickets will be created, but attendees will not receive an email." : undefined} checked={emailTickets} onChange={(e) => setEmailTickets(e.currentTarget.checked)} /></Group>
      <Group justify="flex-end"><Button disabled={program.status !== "ACTIVE" || deadlinePassed || capacityExceeded} loading={issueMutation.isPending} onClick={submitIssue}>Issue {attendees.length} ticket{attendees.length === 1 ? "" : "s"}</Button></Group>
    </Stack></Card>

    <Card withBorder radius="lg" p="lg"><Stack gap="md"><Text fw={700}>Recent direct issuances</Text>{recentIssues.isLoading && <Text size="sm" c="dimmed">Loading recent issuances…</Text>}{recentIssues.data?.length === 0 && <Text size="sm" c="dimmed">No direct complimentary tickets have been issued yet.</Text>}{recentIssues.data?.map((order) => <Group key={order.id} justify="space-between" align="flex-start"><Stack gap={0}><Button component={Link} href={`/events/${eventId}/orders/${order.id}`} variant="subtle" size="compact-sm" px={0}>{order.short_id}</Button><Text size="xs" c="dimmed">{new Date(order.created_at).toLocaleString()} · {order.issued_by ? `${order.issued_by.first_name} ${order.issued_by.last_name}` : "Unknown issuer"}</Text><Text size="sm">{order.items.map((item) => `${item.quantity} × ${item.ticket_display_name}`).join(", ")}</Text></Stack><Stack gap={2} align="flex-end"><Badge variant="light" color={deliveryColor(order)} title={deliveryDescription(order)}>{deliveryLabel(order)}</Badge>{order.delivery_summary_status === "WAITING_FOR_WORKER" && <Text size="xs" c="dimmed" ta="right">Waiting longer than expected</Text>}</Stack></Group>)}</Stack></Card>

    <Card withBorder radius="lg" p="lg"><ComplimentaryDistributorManager eventId={eventId} program={program} products={products} onProgramChange={refreshProgram} /></Card>
    </>}
  </Stack>;
}

function showError(error: Error) { notifications.show({ color: "red", message: error instanceof ApiError ? error.message : "Something went wrong." }); }

function deliveryLabel(order: DirectComplimentaryIssue) {
  return ({ EMAIL_OFF: "Email off", EMAIL_QUEUED: "Email queued", WAITING_FOR_WORKER: "Waiting for email worker", SENT: "Email sent", DELIVERED: "Email delivered", NEEDS_ATTENTION: "Needs attention" })[order.delivery_summary_status];
}

function deliveryColor(order: DirectComplimentaryIssue) {
  return ({ EMAIL_OFF: "gray", EMAIL_QUEUED: "blue", WAITING_FOR_WORKER: "orange", SENT: "blue", DELIVERED: "teal", NEEDS_ATTENTION: "red" })[order.delivery_summary_status];
}

function deliveryDescription(order: DirectComplimentaryIssue) {
  return ({ EMAIL_OFF: "The ticket is valid. Email delivery was not requested.", EMAIL_QUEUED: "The ticket is valid and its email is waiting to be processed.", WAITING_FOR_WORKER: "The ticket is valid, but its email has waited longer than expected for the ticket-delivery worker.", SENT: "The email provider accepted the ticket email.", DELIVERED: "The email provider confirmed delivery.", NEEDS_ATTENTION: "Ticket email delivery failed or was rejected." })[order.delivery_summary_status];
}
