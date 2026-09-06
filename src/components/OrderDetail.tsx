"use client";

import { Fragment, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Collapse,
  Divider,
  Group,
  Menu,
  Modal,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconAlertCircle,
  IconChevronDown,
  IconChevronRight,
  IconDots,
  IconDownload,
  IconMail,
} from "@tabler/icons-react";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import {
  cancelOrder,
  orderView,
  ORDER_VIEW_META,
  refundOrder,
  resendOrderEmail,
  resendOrderTicket,
  type OrderDetail as OrderDetailType,
  type OrderTicket,
  type OrderTicketDeliveryStatus,
  type OrderTicketStatus,
  type OrderView,
} from "@/lib/orderApi";
import { formatEventDate } from "@/lib/eventDateTime";
import { formatAmount } from "@/lib/money";
import type { Event } from "@/lib/eventApi";

/**
 * One fee line on the organizer's order breakdown. Unlike the buyer
 * receipt, the organizer sees every fee whether it was passed on or
 * absorbed — the bearer tag says which, and an absorbed fee is what
 * separates the buyer total from the payout.
 */
function FeeRow({
  label,
  amount,
  bearer,
  currency,
}: {
  label: string;
  amount: string;
  bearer: "ATTENDEE" | "ORGANIZER" | null;
  currency: string;
}) {
  if (Number(amount) <= 0) return null;
  return (
    <Group justify="space-between">
      <Group gap={6}>
        <Text size="sm" c="dimmed">
          {label}
        </Text>
        <Badge size="xs" variant="light" color={bearer === "ATTENDEE" ? "blue" : "gray"}>
          {bearer === "ATTENDEE" ? "buyer pays" : "you absorb"}
        </Badge>
      </Group>
      <Text size="sm">{formatAmount(amount, currency)}</Text>
    </Group>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card withBorder radius="lg" p="xl">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={3} fz={18}>
            {title}
          </Title>
          {action}
        </Group>
        {children}
      </Stack>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text>{children}</Text>
    </Stack>
  );
}

const TICKET_STATUS: Record<OrderTicketStatus, { label: string; color: string }> = {
  UNASSIGNED: { label: "Unassigned", color: "gray" },
  CLAIM_LINK_SENT: { label: "Claim link sent", color: "blue" },
  AWAITING_ACCEPTANCE: { label: "Awaiting acceptance", color: "yellow" },
  ISSUED: { label: "Issued", color: "teal" },
  CHECKED_IN: { label: "Checked in", color: "green" },
  VOIDED: { label: "Voided", color: "red" },
  REFUNDED: { label: "Refunded", color: "orange" },
  SUSPENDED: { label: "Suspended", color: "gray" },
};

const DELIVERY_LINE: Record<OrderTicketDeliveryStatus, { label: string; failed: boolean }> = {
  DELIVERED: { label: "Delivered", failed: false },
  SENT: { label: "Sent", failed: false },
  QUEUED: { label: "Queued", failed: false },
  FAILED: { label: "Email failed", failed: true },
  NOT_EMAILED: { label: "Not emailed", failed: false },
};

const HISTORY_EVENT_LABEL: Record<OrderTicket["history"][number]["event"], string> = {
  ASSIGNED: "Assigned",
  REVOKED: "Revoked",
  REASSIGNED: "Reassigned",
  CLAIMED: "Claimed",
  CORRECTED: "Details corrected",
  INVALIDATED: "Invalidated",
};

const ITEMS_LABEL: Record<OrderView, string> = {
  reserved: "Reserved Items",
  awaiting: "Reserved Items",
  completed: "Ticket Items",
  refunded: "Ticket Items",
  cancelled: "Reserved Items",
  abandoned: "Reserved Items",
};

const TOTAL_LABEL: Record<OrderView, string> = {
  reserved: "Reserved Total",
  awaiting: "Reserved Total",
  completed: "Buyer Total",
  refunded: "Refunded Total",
  cancelled: "Cancelled Total",
  abandoned: "Reserved Total",
};

export function OrderDetail({
  eventId,
  event,
  initialOrder,
}: {
  eventId: number;
  event: Event;
  initialOrder: OrderDetailType;
}) {
  const [order, setOrder] = useState(initialOrder);
  const router = useRouter();
  // Uncontrolled on purpose: modals.openConfirmModal() mounts `children`
  // once, outside this component's own render tree, so a value prop
  // bound to component state would freeze at whatever it was when the
  // modal opened — typed input would never reach onConfirm's closure
  // either, for the same reason. A ref sidesteps both.
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [viewingTerms, setViewingTerms] = useState(false);
  const [resendTicket, setResendTicket] = useState<OrderTicket | null>(null);
  const [resendReason, setResendReason] = useState("");
  const [resendBusy, setResendBusy] = useState(false);
  const [emailResendType, setEmailResendType] = useState<"receipt" | "assignment_invite" | null>(null);
  const [emailResendTo, setEmailResendTo] = useState("");
  const [emailResendUpdate, setEmailResendUpdate] = useState(false);
  const [emailResendReason, setEmailResendReason] = useState("");
  const [emailResendBusy, setEmailResendBusy] = useState(false);
  const [openHistory, setOpenHistory] = useState<Record<number, boolean>>({});

  const view = orderView(order);
  const meta = ORDER_VIEW_META[view];
  const isComplimentaryOrFree = order.complimentary_program_id != null || Number(order.total_amount) <= 0;
  const showFees = view === "completed" || view === "refunded";
  const canRefund = view === "completed" && !isComplimentaryOrFree;
  const canCancel = view === "reserved" || view === "awaiting" || (view === "completed" && isComplimentaryOrFree);
  const showResendMenu = view === "completed";
  const hasUnassignedTicket = order.tickets.some((ticket) => ticket.assignment === null);

  const headerDate: { label: string; value: string | null } = {
    reserved: { label: "Reservation Date", value: order.created_at },
    awaiting: { label: "Reservation Date", value: order.created_at },
    completed: { label: "Date Completed", value: order.completed_at ?? order.created_at },
    refunded: { label: "Date Refunded", value: order.cancelled_at },
    cancelled: { label: "Date Cancelled", value: order.cancelled_at },
    abandoned: { label: "Reservation Date", value: order.created_at },
  }[view];

  const emptyTicketsNote =
    view === "completed" || view === "refunded"
      ? "No tickets on this order."
      : view === "cancelled" || view === "abandoned"
        ? "No tickets were issued for this order."
        : "No tickets issued yet — they're created once payment completes.";

  const footerNote: string | null = {
    reserved: null,
    awaiting: null,
    completed: null,
    refunded: `This order has been refunded. The original payment of ${formatAmount(
      order.total_amount,
      order.currency,
    )} has been returned to the customer's original payment method.`,
    cancelled: "This reservation was cancelled before completion. No tickets were issued and no payment was processed.",
    abandoned: "This reservation expired before payment was completed. No tickets were issued and no payment was processed.",
  }[view];

  const cancelMutation = useMutation({
    mutationFn: (cancelReason: string) => cancelOrder(eventId, order.id, cancelReason || undefined),
    onSuccess: (data: { order: OrderDetailType }) => {
      setOrder(data.order);
      notifications.show({ color: "teal", message: "Order cancelled." });
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({
        color: "red",
        message: error instanceof ApiError ? error.message : "Something went wrong.",
      });
    },
  });

  const refundMutation = useMutation({
    mutationFn: (refundReason: string) => refundOrder(eventId, order.id, refundReason),
    onSuccess: () => {
      notifications.show({
        color: "teal",
        message: "Refund submitted. The order updates once Stripe confirms it.",
      });
      router.refresh();
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({
        color: "red",
        message: error instanceof ApiError ? error.message : "Something went wrong.",
      });
    },
  });

  function openCancelModal() {
    modals.openConfirmModal({
      title: "Cancel this order?",
      centered: true,
      children: (
        <Stack gap="sm">
          <Text size="sm">This releases the reserved inventory and voids every ticket on this order.</Text>
          <Textarea
            ref={reasonRef}
            label="Reason (optional)"
            placeholder="Why is this order being cancelled?"
            autosize
            minRows={2}
          />
        </Stack>
      ),
      labels: { confirm: "Cancel order", cancel: "Keep order" },
      confirmProps: { color: "red" },
      onConfirm: () => cancelMutation.mutate(reasonRef.current?.value ?? ""),
    });
  }

  function openRefundModal() {
    modals.openConfirmModal({
      title: "Refund this order?",
      centered: true,
      children: (
        <Stack gap="sm">
          <Text size="sm">
            This refunds the buyer&apos;s payment through Stripe and voids their tickets. It can&apos;t be undone,
            and it&apos;s blocked once the funds have been transferred to your payout account.
          </Text>
          <Textarea
            ref={reasonRef}
            label="Reason (optional)"
            placeholder="Why is this order being refunded?"
            autosize
            minRows={2}
          />
        </Stack>
      ),
      labels: { confirm: "Refund order", cancel: "Keep order" },
      confirmProps: { color: "red" },
      onConfirm: () => refundMutation.mutate(reasonRef.current?.value ?? ""),
    });
  }

  async function handleResendTicket() {
    if (!resendTicket?.assignment || resendReason.trim().length < 3) return;
    const who = `${resendTicket.assignment.first_name ?? ""} ${resendTicket.assignment.last_name ?? ""}`.trim();
    setResendBusy(true);
    try {
      await resendOrderTicket(eventId, resendTicket.assignment.id, resendReason.trim());
      notifications.show({
        color: "teal",
        message: `Ticket delivery queued${who ? ` for ${who}` : ""}.`,
      });
      setResendTicket(null);
      setResendReason("");
    } catch (error) {
      if (redirectOnAuthError(error as Error, router)) return;
      notifications.show({
        color: "red",
        message: error instanceof ApiError ? error.message : "Unable to resend ticket.",
      });
    } finally {
      setResendBusy(false);
    }
  }

  function openEmailResend(type: "receipt" | "assignment_invite") {
    setEmailResendType(type);
    setEmailResendTo(order.email);
    setEmailResendUpdate(false);
    setEmailResendReason("");
  }

  async function handleEmailResend() {
    if (!emailResendType || emailResendReason.trim().length < 3) return;
    setEmailResendBusy(true);
    try {
      const { data } = await resendOrderEmail(eventId, order.id, {
        type: emailResendType,
        email: emailResendTo.trim() || undefined,
        update_order_email: emailResendUpdate,
        reason: emailResendReason.trim(),
      });
      notifications.show({
        color: "teal",
        message: emailResendType === "receipt" ? "Receipt email queued." : "Assign-tickets invite queued.",
      });
      setEmailResendType(null);
      if (data.email_updated) router.refresh();
    } catch (error) {
      if (redirectOnAuthError(error as Error, router)) return;
      notifications.show({
        color: "red",
        message: error instanceof ApiError ? error.message : "Unable to resend the email.",
      });
    } finally {
      setEmailResendBusy(false);
    }
  }

  const resendMenu = showResendMenu ? (
    <Menu shadow="md" position="bottom-end" withinPortal>
      <Menu.Target>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconMail size={14} />}
          rightSection={<IconChevronDown size={14} />}
        >
          Resend…
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={() => openEmailResend("receipt")}>Order receipt</Menu.Item>
        <Menu.Item onClick={() => openEmailResend("assignment_invite")} disabled={!hasUnassignedTicket}>
          Assign-tickets invite
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  ) : null;

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="center">
        <Title order={2} fz={24}>
          Order {order.short_id}
        </Title>
        <Group gap="sm">
          {resendMenu}
          <Badge color={meta.c} variant="light" size="lg">
            {meta.label}
          </Badge>
        </Group>
      </Group>

      <Section title="Order details">
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <Field label="Order ID">#{order.short_id}</Field>
          <Field label="Event Name">{event.title}</Field>
          <Field label={headerDate.label}>
            {headerDate.value ? formatEventDate(headerDate.value, event.timezone) : "—"}
          </Field>
        </SimpleGrid>
      </Section>

      <Section title="Buyer details">
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Field label="Name">
            {order.first_name} {order.last_name}
          </Field>
          <Field label="Email">{order.email}</Field>
          <Field label="Phone">{order.phone ?? "—"}</Field>
          <Field label="Order Placement Date">{formatEventDate(order.created_at, event.timezone)}</Field>
        </SimpleGrid>
        {view === "cancelled" && order.cancellation_reason && (
          <Text size="sm" c="dimmed">
            Reason: {order.cancellation_reason}
          </Text>
        )}
      </Section>

      {order.terms_acceptance && (
        <Card withBorder radius="lg" p="xl">
          <Group justify="space-between" align="center">
            <Stack gap={0}>
              <Text fw={600}>Terms &amp; Conditions</Text>
              <Text size="sm" c="dimmed">
                Accepted v{order.terms_acceptance.version_number} on{" "}
                {formatEventDate(order.terms_acceptance.accepted_at, event.timezone)}
              </Text>
            </Stack>
            {order.terms_acceptance.content_type === "PDF" ? (
              <Button
                component="a"
                href={`/api/events/${eventId}/terms/versions/${order.terms_acceptance.version_id}/pdf`}
                target="_blank"
                size="xs"
                variant="light"
              >
                View accepted terms
              </Button>
            ) : (
              <Button size="xs" variant="light" onClick={() => setViewingTerms(true)}>
                View accepted terms
              </Button>
            )}
          </Group>
        </Card>
      )}

      <Section title={ITEMS_LABEL[view]}>
        {order.items.map((item) => (
          <Group key={item.id} justify="space-between">
            <Text size="sm">
              {item.quantity} × {item.ticket_display_name}
            </Text>
            <Text size="sm">{formatAmount(item.item_total, order.currency)}</Text>
          </Group>
        ))}
        <Divider />
        {showFees && (
          <>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Subtotal
              </Text>
              <Text size="sm">{formatAmount(order.subtotal, order.currency)}</Text>
            </Group>
            <FeeRow label="Tax" amount={order.tax_amount} bearer={order.tax_bearer} currency={order.currency} />
            <FeeRow
              label="Service fee"
              amount={order.platform_fee}
              bearer={order.platform_fee_bearer}
              currency={order.currency}
            />
            <FeeRow
              label="Processing fee"
              amount={order.processing_fee}
              bearer={order.processing_fee_bearer}
              currency={order.currency}
            />
            <Divider />
          </>
        )}
        <Group justify="space-between">
          <Text fw={700}>{TOTAL_LABEL[view]}</Text>
          <Text fw={700}>{formatAmount(order.total_amount, order.currency)}</Text>
        </Group>

        {view === "completed" &&
          (isComplimentaryOrFree ? (
            <Text size="sm" c="dimmed">
              Complimentary order — no payout.
            </Text>
          ) : (
            <Alert color="teal" variant="light" title="Your Payout">
              <Text size="sm" c="dimmed">
                Amount sent to your Stripe Connect account after platform charges, Stripe processing fees, and taxes
                are deducted.
              </Text>
              <Text fw={700} c="teal" mt={4}>
                {formatAmount(order.organizer_payout_amount, order.currency)}
              </Text>
            </Alert>
          ))}

        {(view === "reserved" || view === "awaiting") && (
          <Alert color="yellow" variant="light" title="Pending Payout">
            <Text size="sm" c="dimmed">
              This payout is pending. The funds of {formatAmount(order.organizer_payout_amount, order.currency)} will be
              sent to your Stripe Connect account once{" "}
              {view === "awaiting" ? "the offline payment clears" : "the reservation is fully confirmed"}.
            </Text>
            <Text fw={700} c="yellow.8" mt={4}>
              {formatAmount(order.organizer_payout_amount, order.currency)} (Pending)
            </Text>
          </Alert>
        )}

        {view === "refunded" && (
          <Alert color="red" variant="light" title="Refunded">
            <Text size="sm" c="dimmed">
              This order was cancelled. A full refund of {formatAmount(order.total_amount, order.currency)} has been
              returned to the customer&apos;s original payment method.
            </Text>
            <Text fw={700} c="teal" mt={4}>
              {formatAmount(order.total_amount, order.currency)} (Returned to Buyer)
            </Text>
          </Alert>
        )}

        {view === "cancelled" && (
          <Alert color="gray" variant="light">
            No payment was processed. This reservation was cancelled before completion.
          </Alert>
        )}

        {view === "abandoned" && (
          <Alert color="gray" variant="light">
            No payment was processed. This reservation expired before it was completed.
          </Alert>
        )}
      </Section>

      <Section title="Assigned Tickets">
        {order.tickets.length === 0 ? (
          <Text size="sm" c="dimmed">
            {emptyTicketsNote}
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th miw={140}>Ticket</Table.Th>
                  <Table.Th miw={120}>Status</Table.Th>
                  <Table.Th miw={110}>Delivery</Table.Th>
                  <Table.Th miw={130}>Attendee</Table.Th>
                  <Table.Th miw={160}>Email</Table.Th>
                  <Table.Th w={48} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {order.tickets.map((ticket) => {
                  const status = TICKET_STATUS[ticket.status];
                  const delivery = DELIVERY_LINE[ticket.delivery_status];
                  const assignment = ticket.assignment;
                  const hasAttendeeEmail = Boolean(assignment?.email && assignment.email.trim());
                  const canResend = Boolean(assignment) && ticket.status !== "VOIDED" && ticket.status !== "REFUNDED";
                  const canDownload = Boolean(assignment?.ticket_pdf_path);
                  const historyOpen = openHistory[ticket.entitlement_id] ?? false;

                  return (
                    <Fragment key={ticket.entitlement_id}>
                      <Table.Tr>
                        <Table.Td>
                          <Group gap={6} wrap="nowrap">
                            {ticket.history.length > 0 && (
                              <IconChevronRight
                                size={14}
                                style={{
                                  cursor: "pointer",
                                  transform: historyOpen ? "rotate(90deg)" : undefined,
                                  transition: "transform 150ms",
                                }}
                                onClick={() =>
                                  setOpenHistory((prev) => ({ ...prev, [ticket.entitlement_id]: !historyOpen }))
                                }
                              />
                            )}
                            <Stack gap={0}>
                              <Text size="sm" fw={600}>
                                {ticket.ticket_name ?? "Ticket"}
                              </Text>
                              <Text size="xs" c="dimmed">
                                #{ticket.sequence_number}
                              </Text>
                            </Stack>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={status.color} variant="light" size="sm" tt="none">
                            {status.label}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={delivery.failed ? "red" : "gray"} variant="light" size="sm" tt="none">
                            {delivery.label}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          {assignment ? (
                            <Text size="sm">
                              {assignment.first_name} {assignment.last_name}
                              {assignment.is_buyer ? " (buyer)" : ""}
                            </Text>
                          ) : (
                            <Text size="sm" c="dimmed">
                              —
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {assignment ? (
                            <Text size="sm" c={hasAttendeeEmail ? undefined : "dimmed"}>
                              {hasAttendeeEmail ? assignment.email : `${order.email} (buyer fallback)`}
                            </Text>
                          ) : (
                            <Text size="sm" c="dimmed">
                              —
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {(canResend || canDownload) && (
                            <Menu shadow="md" position="bottom-end" withinPortal>
                              <Menu.Target>
                                <Button size="compact-xs" variant="subtle" color="gray" aria-label="Ticket actions">
                                  <IconDots size={16} />
                                </Button>
                              </Menu.Target>
                              <Menu.Dropdown>
                                {canResend && (
                                  <Menu.Item
                                    leftSection={<IconMail size={14} />}
                                    onClick={() => {
                                      setResendTicket(ticket);
                                      setResendReason("");
                                    }}
                                  >
                                    Resend ticket
                                  </Menu.Item>
                                )}
                                {canDownload && (
                                  <Menu.Item
                                    component="a"
                                    href={`/api/attendees/${assignment!.id}/ticket`}
                                    target="_blank"
                                    leftSection={<IconDownload size={14} />}
                                  >
                                    Download ticket
                                  </Menu.Item>
                                )}
                              </Menu.Dropdown>
                            </Menu>
                          )}
                        </Table.Td>
                      </Table.Tr>
                      {ticket.history.length > 0 && (
                        <Table.Tr>
                          <Table.Td colSpan={6} p={0} style={{ border: 0 }}>
                            <Collapse in={historyOpen}>
                              <Stack gap={6} px="md" py="sm" bg="var(--mantine-color-gray-0)">
                                {[...ticket.history].reverse().map((entry, i) => (
                                  <Box key={i}>
                                    <Text size="xs">
                                      <Text component="span" fw={600}>
                                        {HISTORY_EVENT_LABEL[entry.event]}
                                      </Text>
                                      {entry.from_name && entry.to_name
                                        ? ` · ${entry.from_name} → ${entry.to_name}`
                                        : entry.to_name
                                          ? ` · ${entry.to_name}`
                                          : ""}
                                      {entry.reason ? ` · ${entry.reason}` : ""}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                      {formatEventDate(entry.at, event.timezone)} · by {entry.actor_label}
                                    </Text>
                                  </Box>
                                ))}
                              </Stack>
                            </Collapse>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Fragment>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Section>

      {(canRefund || canCancel) && (
        <Group justify="flex-end">
          {canRefund && (
            <Button color="red" variant="light" loading={refundMutation.isPending} onClick={openRefundModal}>
              Refund order
            </Button>
          )}
          {canCancel && (
            <Button color="red" variant="light" loading={cancelMutation.isPending} onClick={openCancelModal}>
              Cancel order
            </Button>
          )}
        </Group>
      )}

      {footerNote && (
        <Card withBorder radius="md" p="sm" bg="var(--mantine-color-gray-0)">
          <Text size="xs" c="dimmed" ta="center">
            {footerNote}
          </Text>
        </Card>
      )}

      <Modal opened={viewingTerms} onClose={() => setViewingTerms(false)} title="Accepted Terms & Conditions" size="lg">
        <Box dangerouslySetInnerHTML={{ __html: order.terms_acceptance?.rich_text_content ?? "" }} />
      </Modal>

      <Modal
        opened={emailResendType !== null}
        onClose={() => {
          if (!emailResendBusy) setEmailResendType(null);
        }}
        title={emailResendType === "assignment_invite" ? "Resend assign-tickets invite" : "Resend order receipt"}
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {emailResendType === "assignment_invite"
              ? "Sends the buyer a fresh link to assign their remaining tickets. Any earlier link stops working."
              : "Re-sends the buyer's order receipt. Useful when the original bounced or went to the wrong address."}
          </Text>
          <TextInput
            label="Send to"
            value={emailResendTo}
            onChange={(e) => setEmailResendTo(e.currentTarget.value)}
            placeholder={order.email}
          />
          <Checkbox
            label="Also update this order's email to this address"
            checked={emailResendUpdate}
            onChange={(e) => setEmailResendUpdate(e.currentTarget.checked)}
          />
          <Textarea
            label="Audit reason"
            placeholder="Why are you re-sending this? (e.g., Buyer mistyped their email at checkout)"
            value={emailResendReason}
            onChange={(e) => setEmailResendReason(e.currentTarget.value)}
            required
            minRows={2}
            maxLength={500}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" disabled={emailResendBusy} onClick={() => setEmailResendType(null)}>
              Cancel
            </Button>
            <Button
              leftSection={<IconMail size={16} />}
              loading={emailResendBusy}
              disabled={emailResendReason.trim().length < 3}
              onClick={handleEmailResend}
            >
              Send email
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={!!resendTicket}
        onClose={() => {
          if (!resendBusy) {
            setResendTicket(null);
            setResendReason("");
          }
        }}
        title={`Resend ticket — ${resendTicket?.assignment?.first_name ?? ""} ${resendTicket?.assignment?.last_name ?? ""}`}
        centered
      >
        {resendTicket?.assignment && (
          <Stack gap="md">
            {resendTicket.assignment.email && resendTicket.assignment.email.trim() ? (
              <Alert color="blue" icon={<IconMail size={18} />}>
                <Text size="sm">
                  This ticket email will be delivered to the attendee&apos;s email address:{" "}
                  <strong>{resendTicket.assignment.email}</strong>.
                </Text>
              </Alert>
            ) : (
              <Alert color="orange" icon={<IconAlertCircle size={18} />}>
                <Text size="sm">
                  No individual email is attached for this attendee (e.g. minor, guest, or unassigned). The ticket
                  email will be delivered to the buyer&apos;s email address: <strong>{order.email}</strong>.
                </Text>
              </Alert>
            )}

            <Text size="sm" c="dimmed">
              A new delivery generation will be dispatched to the recipient. The QR credential and ticket reference
              remain unchanged.
            </Text>

            <Textarea
              label="Audit reason"
              placeholder="Why are you resending this ticket? (e.g., Customer requested resend)"
              value={resendReason}
              onChange={(e) => setResendReason(e.currentTarget.value)}
              required
              minRows={2}
              maxLength={500}
            />

            <Group justify="flex-end" mt="xs">
              <Button
                variant="default"
                disabled={resendBusy}
                onClick={() => {
                  setResendTicket(null);
                  setResendReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                leftSection={<IconMail size={16} />}
                loading={resendBusy}
                disabled={resendReason.trim().length < 3}
                onClick={handleResendTicket}
              >
                Confirm &amp; Resend
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
