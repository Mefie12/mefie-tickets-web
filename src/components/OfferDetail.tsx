"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Divider, Group, Progress, SimpleGrid, Stack, Table, Text, Textarea, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft, IconInfoCircle, IconLock } from "@tabler/icons-react";
import { ApiError } from "@/lib/authApi";
import { deleteOffer, getOffer, offerAction, type Offer, type OfferAction, type OfferReport } from "@/lib/offersApi";
import { offerErrorMessage } from "@/lib/offerErrors";
import { discountLabel, shareUrl, STATUS_COLOR, STATUS_LABEL } from "@/lib/offerFormat";
import { scopeLabels, type OfferTicketType } from "@/lib/offerInventory";
import { formatMinorAmount } from "@/lib/money";
import { formatEventDateTime } from "@/lib/eventDateTime";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { OfferForm } from "@/components/OfferForm";
import { TableScrollShadow } from "@/components/TableScrollShadow";

/**
 * One offer: status + actions, results (from the redemption ledger), and
 * its configuration. A DRAFT is editable in place; once activated the
 * economics are read-only with a clear "locked" explanation, and only
 * pause / resume / end remain.
 */
export function OfferDetail({ eventId, currency, timezone, eventStart, publicEventPath, inventory, otherOffers, initialOffer, initialReport, canManage = true }: {
  eventId: number;
  currency: string;
  timezone: string;
  eventStart: string | null;
  publicEventPath: string;
  inventory: OfferTicketType[];
  otherOffers: Offer[];
  initialOffer: Offer;
  initialReport: OfferReport;
  canManage?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["offer", eventId, initialOffer.id],
    queryFn: () => getOffer(eventId, initialOffer.id),
    initialData: { offer: initialOffer, report: initialReport },
  });
  const { offer, report } = query.data;
  const [editing, setEditing] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => { Promise.resolve().then(() => setOrigin(window.location.origin)); }, []);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["offer", eventId, offer.id] });
    void queryClient.invalidateQueries({ queryKey: ["offers", eventId] });
    router.refresh();
  };

  const act = useMutation({
    mutationFn: ({ action, reason }: { action: OfferAction; reason?: string }) => offerAction(eventId, offer.id, action, reason),
    onSuccess: (_, { action }) => {
      notifications.show({ color: "teal", message: { activate: "Offer is live.", pause: "Offer paused.", resume: "Offer resumed.", end: "Offer ended." }[action] });
      refresh();
    },
    onError: (error: Error) => {
      const code = error instanceof ApiError ? error.code : undefined;
      notifications.show({ color: "red", title: "Couldn’t update the offer", message: offerErrorMessage(code, error.message), autoClose: 8000 });
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteOffer(eventId, offer.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["offers", eventId] });
      notifications.show({ color: "teal", message: "Draft deleted." });
      router.push(`/events/${eventId}/offers`);
      router.refresh();
    },
    onError: (error: Error) => notifications.show({ color: "red", message: offerErrorMessage(error instanceof ApiError ? error.code : undefined, error.message) }),
  });

  function confirmActivate() {
    modals.openConfirmModal({
      title: "Make this offer live?",
      centered: true,
      labels: { confirm: "Activate offer", cancel: "Not yet" },
      children: (
        <Stack gap="sm">
          <Text size="sm">{offer.name} — {discountLabel(offer)} on {scopeLabels(offer.scope ?? [], inventory).join(", ") || "no tickets"}.</Text>
          <Text size="sm">Starts {formatEventDateTime(offer.starts_at, timezone)} and ends {formatEventDateTime(offer.ends_at, timezone)}.</Text>
          <Alert color="yellow" variant="light" icon={<IconLock size={16} />}>
            Once active, the discount, tickets, dates, limits and code can’t be changed. You can still pause or end the offer at any time.
          </Alert>
        </Stack>
      ),
      onConfirm: () => act.mutate({ action: "activate" }),
    });
  }

  function confirmWithReason(action: "pause" | "end") {
    let reason = "";
    modals.openConfirmModal({
      title: action === "pause" ? "Pause this offer?" : "End this offer for good?",
      centered: true,
      labels: { confirm: action === "pause" ? "Pause offer" : "End offer", cancel: "Keep it" },
      confirmProps: { color: action === "end" ? "red" : undefined },
      children: (
        <Stack gap="sm">
          <Text size="sm">
            {action === "pause"
              ? "New customers won’t be able to use it. People already in checkout can finish their purchase. You can resume it whenever you like."
              : "Nobody will be able to use it any more, and it can’t be reopened. People already in checkout can finish. Past orders and results are kept."}
          </Text>
          <Textarea label="Reason (optional)" description="Recorded in the activity log." autosize minRows={2} maxLength={500} onChange={(e) => { reason = e.currentTarget.value; }} />
        </Stack>
      ),
      onConfirm: () => act.mutate({ action, reason: reason.trim() || undefined }),
    });
  }

  function confirmDelete() {
    modals.openConfirmModal({
      title: "Delete this draft?", centered: true, labels: { confirm: "Delete draft", cancel: "Keep it" }, confirmProps: { color: "red" },
      children: <Text size="sm">This draft hasn’t been used by anyone. Deleting it can’t be undone.</Text>,
      onConfirm: () => remove.mutate(),
    });
  }

  const link = offer.share_token && origin ? shareUrl(`${origin}${publicEventPath}`, offer.share_token) : null;
  const limit = report.global_ticket_limit;
  const pct = limit ? Math.min(100, Math.round((report.consumed_ticket_units / limit) * 100)) : null;
  const notYetStarted = offer.status === "ACTIVE" && new Date(offer.starts_at) > new Date();
  const pastEnd = offer.status === "ACTIVE" && new Date(offer.ends_at) <= new Date();

  return (
    <Stack gap="lg">
      <Button component={Link} href={`/events/${eventId}/offers`} variant="subtle" color="gray" size="compact-sm" leftSection={<IconArrowLeft size={14} />} style={{ alignSelf: "flex-start" }}>All offers</Button>

      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Stack gap={6}>
          <Group gap="xs"><Title order={2} fz={24}>{offer.name}</Title><Badge color={STATUS_COLOR[offer.status]} variant="light" size="lg">{STATUS_LABEL[offer.status]}</Badge></Group>
          <Group gap="xs"><Badge variant="outline" color="gray">{offer.activation === "CODE" ? "Promo code" : "Automatic"}</Badge>{/* The zone abbreviation differs between Node and browser ICU ("GMT" vs "GMT+0"), so this one text node is exempt from the hydration check. */}
          <Text size="sm" c="dimmed" suppressHydrationWarning>{discountLabel(offer)} · {formatEventDateTime(offer.starts_at, timezone)} – {formatEventDateTime(offer.ends_at, timezone)}</Text></Group>
        </Stack>
        {canManage && (
          <Group gap="xs">
            {offer.status === "DRAFT" && <>
              <Button variant="default" onClick={() => setEditing((e) => !e)}>{editing ? "Cancel editing" : "Edit"}</Button>
              <Button color="red" variant="subtle" onClick={confirmDelete} loading={remove.isPending}>Delete</Button>
              <Button onClick={confirmActivate} loading={act.isPending} disabled={(offer.scope ?? []).length === 0}>Activate</Button>
            </>}
            {offer.status === "ACTIVE" && <><Button variant="default" onClick={() => confirmWithReason("pause")} loading={act.isPending}>Pause</Button><Button color="red" variant="light" onClick={() => confirmWithReason("end")}>End</Button></>}
            {offer.status === "PAUSED" && <><Button onClick={() => act.mutate({ action: "resume" })} loading={act.isPending}>Resume</Button><Button color="red" variant="light" onClick={() => confirmWithReason("end")}>End</Button></>}
          </Group>
        )}
      </Group>

      {offer.status === "DRAFT" && <Alert color="blue" variant="light" icon={<IconInfoCircle size={18} />}>This offer is a draft — buyers can’t use it yet.{(offer.scope ?? []).length === 0 ? " Choose at least one ticket to activate it." : ""}</Alert>}
      {notYetStarted && <Alert color="blue" variant="light" icon={<IconInfoCircle size={18} />}><span suppressHydrationWarning>Scheduled — it goes live {formatEventDateTime(offer.starts_at, timezone)}.</span></Alert>}
      {pastEnd && <Alert color="gray" variant="light" icon={<IconInfoCircle size={18} />}>This offer’s end time has passed, so it no longer applies. You can mark it as ended.</Alert>}

      {offer.status === "DRAFT" && editing ? (
        <OfferForm eventId={eventId} currency={currency} timezone={timezone} eventStart={eventStart} inventory={inventory} otherOffers={otherOffers} initial={offer} publicEventPath={publicEventPath} onSaved={() => setEditing(false)} />
      ) : (
        <>
          {offer.status !== "DRAFT" && (
            <>
              <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
                <Stat label="Orders" value={String(report.redemptions)} />
                <Stat label="Discounted tickets" value={String(report.discounted_tickets)} hint={report.in_checkout_tickets > 0 ? `${report.in_checkout_tickets} in checkout` : undefined} />
                <Stat label="Eligible sales" value={formatMinorAmount(report.gross_eligible_minor, currency)} />
                <Stat label="Discount given" value={formatMinorAmount(report.discount_granted_minor, currency)} />
                <Stat label="Net after discount" value={formatMinorAmount(report.discounted_net_minor, currency)} />
                <Stat label="Refunded orders" value={String(report.refunded_redemptions)} />
              </SimpleGrid>
              {pct !== null && (
                <Card withBorder radius="lg" p="md">
                  <Stack gap={6}>
                    <Group justify="space-between"><Text size="sm" fw={600}>Discounted tickets used</Text><Text size="sm">{report.consumed_ticket_units} / {limit}</Text></Group>
                    <Progress value={pct} size="md" radius="xl" color={pct >= 80 ? "orange" : undefined} aria-label={`${report.consumed_ticket_units} of ${limit} discounted tickets used`} />
                    {pct >= 80 && <Text size="xs" c="dimmed">Nearly used up — once it’s gone, buyers pay regular prices.</Text>}
                  </Stack>
                </Card>
              )}
              <Card withBorder radius="lg" p={0}>
                <Stack gap={0}>
                  <Text fw={600} px="md" pt="md" pb="xs">By ticket</Text>
                  {report.by_ticket.length === 0 ? <Text size="sm" c="dimmed" px="md" pb="md">No completed orders have used this offer yet.</Text> : (
                    <TableScrollShadow minWidth={560}>
                      <Table verticalSpacing="xs" horizontalSpacing="md">
                        <Table.Thead><Table.Tr><Table.Th>Ticket</Table.Th><Table.Th ta="right">Tickets</Table.Th><Table.Th ta="right">Eligible sales</Table.Th><Table.Th ta="right">Discount</Table.Th><Table.Th ta="right">Net</Table.Th></Table.Tr></Table.Thead>
                        <Table.Tbody>
                          {report.by_ticket.map((row) => (
                            <Table.Tr key={`${row.product_id}:${row.ticket_option_id}`}>
                              <Table.Td>{row.name}</Table.Td>
                              <Table.Td ta="right">{row.discounted_units}</Table.Td>
                              <Table.Td ta="right">{formatMinorAmount(row.gross_eligible_minor, currency)}</Table.Td>
                              <Table.Td ta="right">{formatMinorAmount(row.discount_granted_minor, currency)}</Table.Td>
                              <Table.Td ta="right">{formatMinorAmount(row.discounted_net_minor, currency)}</Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </TableScrollShadow>
                  )}
                </Stack>
              </Card>
            </>
          )}

          {offer.activation === "CODE" && (
            <Card withBorder radius="lg" p="lg">
              <Stack gap="md">
                <Text fw={600}>Share this offer</Text>
                <Group justify="space-between" wrap="nowrap" gap="sm">
                  <Stack gap={0}><Text size="xs" c="dimmed">Promo code</Text><Text ff="monospace" fw={600} fz={18}>{offer.code}</Text></Stack>
                  {offer.code && <CopyLinkButton value={offer.code} />}
                </Group>
                <Divider />
                <Group justify="space-between" wrap="nowrap" gap="sm" align="flex-end">
                  <Stack gap={0} style={{ minWidth: 0 }}><Text size="xs" c="dimmed">Share link — applies the offer without showing the code</Text><Text size="sm" style={{ overflowWrap: "anywhere" }}>{link ?? "…"}</Text></Stack>
                  {link && <CopyLinkButton value={link} />}
                </Group>
                {offer.status === "DRAFT" && <Text size="xs" c="dimmed">The code and link only work once the offer is active.</Text>}
              </Stack>
            </Card>
          )}

          <Card withBorder radius="lg" p="lg">
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600}>Configuration</Text>
                {offer.is_locked && <Badge variant="light" color="gray" leftSection={<IconLock size={12} />}>Locked after activation</Badge>}
              </Group>
              <Config label="Discount" value={discountLabel(offer)} />
              <Config label="Tickets" value={scopeLabels(offer.scope ?? [], inventory).join(", ") || "—"} />
              <Config label="Total discounted tickets" value={offer.global_ticket_limit ? String(offer.global_ticket_limit) : "No limit"} />
              <Config label="Per customer" value={offer.per_customer_ticket_limit ? `${offer.per_customer_ticket_limit} (email verification required)` : "No limit"} />
              <Config label="Per order" value={offer.per_order_ticket_limit ? String(offer.per_order_ticket_limit) : "No limit"} />
              {offer.internal_description && <Config label="Internal note" value={offer.internal_description} />}
              {offer.is_locked && <Text size="xs" c="dimmed">The discount, tickets, dates, limits and code can’t be changed once an offer has been activated. Pause or end it and create a new one instead.</Text>}
            </Stack>
          </Card>
        </>
      )}
    </Stack>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap={2}>
        <Text size="xs" c="dimmed">{label}</Text>
        <Text fw={700} fz={20} style={{ fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>{value}</Text>
        {hint && <Text size="xs" c="dimmed">{hint}</Text>}
      </Stack>
    </Card>
  );
}

function Config({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
      <Text size="sm" c="dimmed" style={{ flex: "0 0 40%" }}>{label}</Text>
      <Text size="sm" ta="right" style={{ overflowWrap: "anywhere" }}>{value}</Text>
    </Group>
  );
}
