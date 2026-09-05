"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Alert, Badge, Box, Button, Card, Divider, Group, Modal, Stack, Text, Textarea, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconAlertCircle, IconDownload, IconMail } from "@tabler/icons-react";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { cancelOrder, resendOrderTicket, type OrderAttendee, type OrderDetail as OrderDetailType, type OrderStatus } from "@/lib/orderApi";
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

const STATUS_COLOR: Record<OrderStatus, string> = {
  RESERVED: "yellow",
  COMPLETED: "teal",
  CANCELLED: "red",
  AWAITING_OFFLINE_PAYMENT: "gray",
  ABANDONED: "dark",
};

const CANCELLABLE: OrderStatus[] = ["RESERVED", "COMPLETED"];

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
  const [resendModalAttendee, setResendModalAttendee] = useState<OrderAttendee | null>(null);
  const [resendReason, setResendReason] = useState("");
  const [resendBusy, setResendBusy] = useState(false);

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

  function openCancelModal() {
    modals.openConfirmModal({
      title: "Cancel this order?",
      centered: true,
      children: (
        <Stack gap="sm">
          <Text size="sm">
            This releases the reserved inventory and voids every attendee on this order. It does not issue a
            refund — that still happens outside this system.
          </Text>
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

  async function handleResendTicket() {
    if (!resendModalAttendee || resendReason.trim().length < 3) return;
    setResendBusy(true);
    try {
      await resendOrderTicket(eventId, resendModalAttendee.id, resendReason.trim());
      notifications.show({
        color: "teal",
        message: `Ticket delivery queued for ${resendModalAttendee.first_name} ${resendModalAttendee.last_name}.`,
      });
      setResendModalAttendee(null);
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

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="flex-start">
        <Stack gap={0}>
          <Text size="sm" c="dimmed">
            {event.title}
          </Text>
          <Title order={2} fz={24}>
            {order.short_id}
          </Title>
        </Stack>
        <Badge color={STATUS_COLOR[order.status]} variant="light" size="lg">
          {order.status}
        </Badge>
      </Group>

      <Card withBorder radius="lg" p="xl">
        <Stack gap="md">
          <Title order={3} fz={18}>
            Buyer
          </Title>
          <Group grow>
            <Stack gap={0}>
              <Text size="xs" c="dimmed">
                Name
              </Text>
              <Text fw={600}>
                {order.first_name} {order.last_name}
              </Text>
            </Stack>
            <Stack gap={0}>
              <Text size="xs" c="dimmed">
                Email
              </Text>
              <Text>{order.email}</Text>
            </Stack>
          </Group>
          <Group grow>
            <Stack gap={0}>
              <Text size="xs" c="dimmed">
                Phone
              </Text>
              <Text>{order.phone ?? "—"}</Text>
            </Stack>
            <Stack gap={0}>
              <Text size="xs" c="dimmed">
                Placed
              </Text>
              <Text>{formatEventDate(order.created_at, event.timezone)}</Text>
            </Stack>
          </Group>
          {order.cancelled_at && (
            <Stack gap={0}>
              <Text size="xs" c="dimmed">
                Cancelled
              </Text>
              <Text>
                {formatEventDate(order.cancelled_at, event.timezone)}
                {order.cancellation_reason ? ` — ${order.cancellation_reason}` : ""}
              </Text>
            </Stack>
          )}
        </Stack>
      </Card>

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

      <Card withBorder radius="lg" p="xl">
        <Stack gap="sm">
          <Title order={3} fz={18}>
            Items
          </Title>
          {order.items.map((item) => (
            <Group key={item.id} justify="space-between">
              <Text size="sm">
                {item.quantity} × {item.ticket_display_name}
              </Text>
              <Text size="sm">{formatAmount(item.item_total, order.currency)}</Text>
            </Group>
          ))}
          <Divider />
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Subtotal</Text>
            <Text size="sm">{formatAmount(order.subtotal, order.currency)}</Text>
          </Group>
          <FeeRow label="Tax" amount={order.tax_amount} bearer={order.tax_bearer} currency={order.currency} />
          <FeeRow label="Service fee" amount={order.platform_fee} bearer={order.platform_fee_bearer} currency={order.currency} />
          <FeeRow label="Processing fee" amount={order.processing_fee} bearer={order.processing_fee_bearer} currency={order.currency} />
          <Divider />
          <Group justify="space-between">
            <Text fw={600}>Buyer total</Text>
            <Text fw={600}>{formatAmount(order.total_amount, order.currency)}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Your payout (before Stripe transfer)</Text>
            <Text size="sm">{formatAmount(order.organizer_payout_amount, order.currency)}</Text>
          </Group>
        </Stack>
      </Card>

      <Card withBorder radius="lg" p="xl">
        <Stack gap="sm">
          <Title order={3} fz={18}>
            Attendees &amp; Ticket Delivery
          </Title>
          {order.attendees.map((attendee) => {
            const hasAttendeeEmail = Boolean(attendee.email && attendee.email.trim());
            const displayEmail = hasAttendeeEmail ? attendee.email : `${order.email} (Buyer fallback)`;

            return (
              <Card key={attendee.id} withBorder radius="md" p="sm">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={2}>
                    <Text fw={600} size="sm">
                      {attendee.first_name} {attendee.last_name}
                      {attendee.is_buyer && (
                        <Text component="span" size="xs" c="dimmed">
                          {" "}
                          (buyer)
                        </Text>
                      )}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {displayEmail} · {attendee.product.title}
                    </Text>
                    {attendee.voided_at && (
                      <Badge color="red" variant="light" size="xs" style={{ alignSelf: "flex-start" }}>
                        Voided
                      </Badge>
                    )}
                  </Stack>
                  <Group gap="xs" align="center">
                    {!attendee.voided_at && (
                      <Button
                        size="xs"
                        leftSection={<IconMail size={14} />}
                        onClick={() => {
                          setResendModalAttendee(attendee);
                          setResendReason("");
                        }}
                      >
                        Resend ticket
                      </Button>
                    )}
                    {attendee.ticket_pdf_path && (
                      <Button
                        component="a"
                        href={`/api/attendees/${attendee.id}/ticket`}
                        target="_blank"
                        size="xs"
                        variant="subtle"
                        color="gray"
                        leftSection={<IconDownload size={14} />}
                      >
                        Download PDF
                      </Button>
                    )}
                  </Group>
                </Group>
              </Card>
            );
          })}
        </Stack>
      </Card>

      {CANCELLABLE.includes(order.status) && (
        <Group justify="flex-end">
          <Button color="red" variant="light" loading={cancelMutation.isPending} onClick={openCancelModal}>
            Cancel order
          </Button>
        </Group>
      )}

      <Modal opened={viewingTerms} onClose={() => setViewingTerms(false)} title="Accepted Terms & Conditions" size="lg">
        <Box dangerouslySetInnerHTML={{ __html: order.terms_acceptance?.rich_text_content ?? "" }} />
      </Modal>

      <Modal
        opened={!!resendModalAttendee}
        onClose={() => {
          if (!resendBusy) {
            setResendModalAttendee(null);
            setResendReason("");
          }
        }}
        title={`Resend Ticket — ${resendModalAttendee?.first_name} ${resendModalAttendee?.last_name}`}
        centered
      >
        {resendModalAttendee && (
          <Stack gap="md">
            {resendModalAttendee.email && resendModalAttendee.email.trim() ? (
              <Alert color="blue" icon={<IconMail size={18} />}>
                <Text size="sm">
                  This ticket email will be delivered to the attendee&apos;s email address:{" "}
                  <strong>{resendModalAttendee.email}</strong>.
                </Text>
              </Alert>
            ) : (
              <Alert color="orange" icon={<IconAlertCircle size={18} />}>
                <Text size="sm">
                  No individual email is attached for this attendee (e.g. minor, guest, or unassigned). The ticket email will be delivered to the buyer&apos;s email address:{" "}
                  <strong>{order.email}</strong>.
                </Text>
              </Alert>
            )}

            <Text size="sm" c="dimmed">
              A new delivery generation will be dispatched to the recipient. The QR credential and ticket reference remain unchanged.
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
                  setResendModalAttendee(null);
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
