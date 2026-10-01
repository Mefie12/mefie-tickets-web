"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, Center, Drawer, Group, Loader, Select, Stack, Table, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { adminGetOffer, adminListOffers, adminOfferAction, type Offer, type OfferStatus } from "@/lib/offersApi";
import { discountLabel, STATUS_COLOR, STATUS_LABEL } from "@/lib/offerFormat";
import { formatMinorAmount } from "@/lib/money";
import { AdminReasonModal } from "@/components/AdminReasonModal";
import { TableScrollShadow } from "@/components/TableScrollShadow";

/**
 * Platform-wide oversight of offers: list + filters, a detail drawer with
 * the ledger-derived results, and pause / end with a mandatory reason that
 * goes to the audit log. Admins never create or edit offers here.
 */
export default function AdminOffersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<OfferStatus | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, setPending] = useState<{ offer: Offer; action: "pause" | "end" } | null>(null);

  const list = useQuery({ queryKey: ["admin-offers", status], queryFn: () => adminListOffers({ status: status ?? undefined, per_page: 50 }) });
  const detail = useQuery({ queryKey: ["admin-offer", selected], queryFn: () => adminGetOffer(selected as number), enabled: selected !== null });

  const act = useMutation({
    mutationFn: ({ offer, action, reason }: { offer: Offer; action: "pause" | "end"; reason: string }) => adminOfferAction(offer.id, action, reason),
    onSuccess: (_, { action }) => {
      notifications.show({ color: "teal", message: action === "pause" ? "Offer paused." : "Offer ended." });
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-offers"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-offer"] });
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({ color: "red", message: error instanceof ApiError ? error.message : "Something went wrong." });
    },
  });

  const offers = list.data?.offers ?? [];
  const current = detail.data;

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={2}>Offers</Title>
        <Text c="dimmed">Every discount and promo across all events. You can pause or end an offer; organizers create and edit them.</Text>
      </Stack>

      <Group>
        <Select aria-label="Filter by status" placeholder="All statuses" clearable value={status} onChange={(v) => setStatus((v as OfferStatus | null) ?? null)}
          data={(["DRAFT", "ACTIVE", "PAUSED", "ENDED"] as OfferStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))} w={200} />
      </Group>

      {list.isLoading ? <Center py="xl"><Loader size="sm" /></Center> : (
        <Card withBorder radius="lg" p={0}>
          <TableScrollShadow minWidth={820}>
            <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
              <Table.Thead><Table.Tr><Table.Th>Offer</Table.Th><Table.Th>Event</Table.Th><Table.Th>Discount</Table.Th><Table.Th>Status</Table.Th><Table.Th>Used</Table.Th><Table.Th /></Table.Tr></Table.Thead>
              <Table.Tbody>
                {offers.length === 0 && <Table.Tr><Table.Td colSpan={6}><Text c="dimmed" size="sm" ta="center" py="md">No offers match.</Text></Table.Td></Table.Tr>}
                {offers.map((offer) => (
                  <Table.Tr key={offer.id}>
                    <Table.Td>
                      <Text fw={600} size="sm">{offer.name}</Text>
                      <Group gap={6}><Badge size="xs" variant="outline" color="gray">{offer.activation === "CODE" ? "Code" : "Automatic"}</Badge>{offer.code && <Text size="xs" c="dimmed" ff="monospace">{offer.code}</Text>}</Group>
                    </Table.Td>
                    <Table.Td><Text size="sm">{offer.event?.title ?? `Event #${offer.event_id}`}</Text></Table.Td>
                    <Table.Td><Text size="sm">{discountLabel(offer)}</Text></Table.Td>
                    <Table.Td><Badge color={STATUS_COLOR[offer.status]} variant="light">{STATUS_LABEL[offer.status]}</Badge></Table.Td>
                    <Table.Td><Text size="sm">{offer.consumed_ticket_units}{offer.global_ticket_limit ? ` / ${offer.global_ticket_limit}` : ""}</Text></Table.Td>
                    <Table.Td ta="right"><Button size="compact-sm" variant="light" onClick={() => setSelected(offer.id)}>View</Button></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </TableScrollShadow>
        </Card>
      )}

      <Drawer opened={selected !== null} onClose={() => setSelected(null)} position="right" size="md" title={current?.offer.name ?? "Offer"}>
        {detail.isLoading || !current ? <Center py="xl"><Loader size="sm" /></Center> : (
          <Stack gap="md">
            <Group gap="xs"><Badge color={STATUS_COLOR[current.offer.status]} variant="light">{STATUS_LABEL[current.offer.status]}</Badge><Text size="sm" c="dimmed">{current.offer.event?.title}</Text></Group>
            <Stack gap={6}>
              <Row label="Discount" value={discountLabel(current.offer)} />
              <Row label="Window" value={`${new Date(current.offer.starts_at).toLocaleString()} – ${new Date(current.offer.ends_at).toLocaleString()}`} />
              <Row label="Limits" value={[current.offer.global_ticket_limit && `${current.offer.global_ticket_limit} total`, current.offer.per_customer_ticket_limit && `${current.offer.per_customer_ticket_limit} per customer`, current.offer.per_order_ticket_limit && `${current.offer.per_order_ticket_limit} per order`].filter(Boolean).join(" · ") || "None"} />
              <Row label="Orders" value={String(current.report.redemptions)} />
              <Row label="Discounted tickets" value={`${current.report.discounted_tickets} (${current.report.in_checkout_tickets} in checkout)`} />
              <Row label="Discount given" value={formatMinorAmount(current.report.discount_granted_minor, current.report.currency_code)} />
              <Row label="Net after discount" value={formatMinorAmount(current.report.discounted_net_minor, current.report.currency_code)} />
              <Row label="Refunded orders" value={String(current.report.refunded_redemptions)} />
              <Row label="Capacity counter" value={`${current.report.consumed_ticket_units}${current.report.global_ticket_limit ? ` / ${current.report.global_ticket_limit}` : ""}`} />
            </Stack>
            <Group>
              {current.offer.status === "ACTIVE" && <Button variant="default" onClick={() => setPending({ offer: current.offer, action: "pause" })}>Pause</Button>}
              {(current.offer.status === "ACTIVE" || current.offer.status === "PAUSED") && <Button color="red" variant="light" onClick={() => setPending({ offer: current.offer, action: "end" })}>End</Button>}
            </Group>
          </Stack>
        )}
      </Drawer>

      <AdminReasonModal
        opened={pending !== null}
        onClose={() => setPending(null)}
        title={pending?.action === "end" ? "End this offer?" : "Pause this offer?"}
        description={pending?.action === "end" ? "This is permanent. People already in checkout can finish. The reason is recorded in the audit log." : "New customers won’t be able to use it. The organizer can resume it. The reason is recorded in the audit log."}
        confirmLabel={pending?.action === "end" ? "End offer" : "Pause offer"}
        confirmColor={pending?.action === "end" ? "red" : "blue"}
        loading={act.isPending}
        onConfirm={(reason) => pending && act.mutate({ offer: pending.offer, action: pending.action, reason })}
      />
    </Stack>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
      <Text size="sm" c="dimmed" style={{ flex: "0 0 40%" }}>{label}</Text>
      <Text size="sm" ta="right" style={{ overflowWrap: "anywhere" }}>{value}</Text>
    </Group>
  );
}
