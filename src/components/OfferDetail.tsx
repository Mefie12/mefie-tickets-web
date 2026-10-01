"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Alert, Anchor, Badge, Breadcrumbs, Button, Card, Divider, Group, Progress, SimpleGrid, Stack, Table, Text, Title } from "@mantine/core";
import { IconArrowLeft, IconCopy, IconInfoCircle, IconLock } from "@tabler/icons-react";
import { getOffer, type Offer, type OfferReport } from "@/lib/offersApi";
import { useOfferActions } from "@/lib/useOfferActions";
import { discountLabel, shareUrl, STATUS_COLOR, STATUS_LABEL } from "@/lib/offerFormat";
import { scopeLabels, type OfferTicketType } from "@/lib/offerInventory";
import { formatMinorAmount } from "@/lib/money";
import { formatEventDateTime } from "@/lib/eventDateTime";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { CopyableCode } from "@/components/CopyableCode";
import { OfferForm } from "@/components/OfferForm";
import { TableScrollShadow } from "@/components/TableScrollShadow";

/**
 * One offer: status + actions, results (from the redemption ledger), and
 * its configuration. A DRAFT is editable in place; once activated the
 * economics are read-only with a clear "locked" explanation, and only
 * pause / resume / end remain.
 */
export function OfferDetail({ eventId, currency, timezone, eventStart, publicEventPath, eventStatus, inventory, otherOffers, initialOffer, initialReport, canManage = true }: {
  eventId: number;
  currency: string;
  timezone: string;
  eventStart: string | null;
  publicEventPath: string;
  /** The event's own status: only a LIVE event has a public page for the code/link to open. */
  eventStatus: string;
  inventory: OfferTicketType[];
  otherOffers: Offer[];
  initialOffer: Offer;
  initialReport: OfferReport;
  canManage?: boolean;
}) {
  const router = useRouter();
  const query = useQuery({
    queryKey: ["offer", eventId, initialOffer.id],
    queryFn: () => getOffer(eventId, initialOffer.id),
    initialData: { offer: initialOffer, report: initialReport },
  });
  const { offer, report } = query.data;
  const searchParams = useSearchParams();
  // ?edit=1 (from the list's row menu) opens a draft straight in edit mode.
  const [editing, setEditing] = useState(() => initialOffer.status === "DRAFT" && searchParams.get("edit") === "1");
  const [origin, setOrigin] = useState("");
  useEffect(() => { Promise.resolve().then(() => setOrigin(window.location.origin)); }, []);

  const actions = useOfferActions({ eventId, timezone, inventory, onDeleted: () => router.push(`/events/${eventId}/offers`) });

  const link = offer.share_token && origin ? shareUrl(`${origin}${publicEventPath}`, offer.share_token) : null;
  const limit = report.global_ticket_limit;
  const pct = limit ? Math.min(100, Math.round((report.consumed_ticket_units / limit) * 100)) : null;
  const notYetStarted = offer.status === "ACTIVE" && new Date(offer.starts_at) > new Date();
  const pastEnd = offer.status === "ACTIVE" && new Date(offer.ends_at) <= new Date();

  return (
    <Stack gap="lg">
      {/* Always-visible way back to the list: breadcrumb for orientation + an explicit button. */}
      <Group justify="space-between" align="center" wrap="wrap" gap="xs">
        <Breadcrumbs separator="›" aria-label="Breadcrumb">
          <Anchor component={Link} href={`/events/${eventId}/offers`} size="sm">Offers</Anchor>
          <Text size="sm" c="dimmed" style={{ overflowWrap: "anywhere" }}>{offer.name}</Text>
        </Breadcrumbs>
        <Button component={Link} href={`/events/${eventId}/offers`} variant="default" size="compact-md" leftSection={<IconArrowLeft size={14} />}>Back to all offers</Button>
      </Group>

      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Stack gap={6}>
          <Group gap="xs"><Title order={2} fz={24}>{offer.name}</Title><Badge color={STATUS_COLOR[offer.status]} variant="light" size="lg">{STATUS_LABEL[offer.status]}</Badge></Group>
          <Group gap="xs"><Badge variant="outline" color="gray">{offer.activation === "CODE" ? "Promo code" : "Automatic"}</Badge>{/* The zone abbreviation differs between Node and browser ICU ("GMT" vs "GMT+0"), so this one text node is exempt from the hydration check. */}
          <Text size="sm" c="dimmed" suppressHydrationWarning>{discountLabel(offer)} · {formatEventDateTime(offer.starts_at, timezone)} – {formatEventDateTime(offer.ends_at, timezone)}</Text></Group>
        </Stack>
        {canManage && (
          <Group gap="xs">
            {/* Any offer can be duplicated into a new editable draft — the way to change the terms of a live one. */}
            <Button component={Link} href={`/events/${eventId}/offers/new?from=${offer.id}`} variant="default" leftSection={<IconCopy size={14} />}>Duplicate</Button>
            {offer.status === "DRAFT" && <>
              <Button variant="default" onClick={() => setEditing((e) => !e)}>{editing ? "Cancel editing" : "Edit"}</Button>
              <Button color="red" variant="subtle" onClick={() => actions.remove(offer)} loading={actions.busy}>Delete</Button>
              <Button onClick={() => actions.activate(offer)} loading={actions.busy} disabled={(offer.scope ?? []).length === 0}>Activate</Button>
            </>}
            {offer.status === "ACTIVE" && <><Button variant="default" onClick={() => actions.pause(offer)} loading={actions.busy}>Pause</Button><Button color="red" variant="light" onClick={() => actions.end(offer)}>End</Button></>}
            {offer.status === "PAUSED" && <><Button onClick={() => actions.resume(offer)} loading={actions.busy}>Resume</Button><Button color="red" variant="light" onClick={() => actions.end(offer)}>End</Button></>}
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
                  <Stack gap={6}><Text size="xs" c="dimmed">Promo code — click to copy</Text>{offer.code && <CopyableCode value={offer.code} size="lg" />}</Stack>
                </Group>
                <Divider />
                <Group justify="space-between" wrap="nowrap" gap="sm" align="flex-end">
                  <Stack gap={0} style={{ minWidth: 0 }}><Text size="xs" c="dimmed">Share link — applies the offer without showing the code</Text><Text size="sm" style={{ overflowWrap: "anywhere" }}>{link ?? "…"}</Text></Stack>
                  {link && <CopyLinkButton value={link} />}
                </Group>
                {eventStatus !== "LIVE" && <EventNotLiveNotice eventId={eventId} offerId={offer.id} eventStatus={eventStatus} />}
                {offer.status !== "ACTIVE" && <Text size="xs" c="dimmed">The code and link only work once the offer is active{offer.status === "PAUSED" ? " again" : ""}.</Text>}
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
              {offer.is_locked && <Text size="xs" c="dimmed">The discount, tickets, dates, limits and code can’t be changed once an offer has been activated. To change them, duplicate this offer into a new draft (button at the top), then end this one when the new one is live.</Text>}
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

/**
 * The share link opens the event's public page, which only exists once the
 * event is published. Instead of leaving the organizer to find the switch,
 * this deep-links to Event settings with the publish confirmation already
 * open (and brings them back here afterwards); any publish blocker (missing
 * cover image, payment setup, …) is handled by that confirmation.
 */
function EventNotLiveNotice({ eventId, offerId, eventStatus }: { eventId: number; offerId: number; eventStatus: string }) {
  const back = encodeURIComponent(`/events/${eventId}/offers/${offerId}`);
  const archived = eventStatus === "ARCHIVED";

  return (
    <Alert color="yellow" variant="light" icon={<IconInfoCircle size={18} />} title={archived ? "This event is archived" : "This event isn’t published yet"}>
      <Stack gap="sm">
        <Text size="sm">
          {archived
            ? "Archived events have no public page, so this link and code can’t be used. Restore the event as a draft, then publish it."
            : "The link and code open the event’s public page, which doesn’t exist until the event is published. Until then, buyers see “page does not exist”."}
        </Text>
        <Group gap="xs">
          <Button component={Link} href={`/events/${eventId}/settings?${archived ? "" : "publish=1&"}returnTo=${back}`} size="compact-md">
            {archived ? "Open event settings" : "Publish event"}
          </Button>
          {!archived && <Text size="xs" c="dimmed">You’ll confirm on the next screen, then come straight back here.</Text>}
        </Group>
      </Stack>
    </Alert>
  );
}
