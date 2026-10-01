"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card, Group, Progress, SegmentedControl, SimpleGrid, Stack, Table, Text, Title, UnstyledButton } from "@mantine/core";
import { IconBolt, IconDiscount2, IconPercentage, IconPlus, IconTicket } from "@tabler/icons-react";
import { listOffers, type Offer, type OfferStatus } from "@/lib/offersApi";
import { discountLabel, STATUS_COLOR, STATUS_LABEL } from "@/lib/offerFormat";
import { formatEventDate } from "@/lib/eventDateTime";
import { TableScrollShadow } from "@/components/TableScrollShadow";

type Filter = "ALL" | OfferStatus;

/**
 * Organizer offers list for one event: status tabs, a table with a usage
 * meter per offer, and a purposeful empty state with three starting points.
 */
export function OffersList({ eventId, timezone, initialOffers, canManage = true }: {
  eventId: number;
  timezone: string;
  initialOffers: Offer[];
  canManage?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const offers = useQuery({ queryKey: ["offers", eventId], queryFn: () => listOffers(eventId).then((r) => r.offers), initialData: initialOffers });
  const all = offers.data;
  const visible = filter === "ALL" ? all : all.filter((o) => o.status === filter);
  const count = (status: OfferStatus) => all.filter((o) => o.status === status).length;

  if (all.length === 0) {
    return (
      <Stack gap="lg">
        <Header eventId={eventId} canManage={canManage} />
        <Card withBorder radius="lg" p="xl">
          <Stack gap="lg" align="center" ta="center" maw={560} mx="auto">
            <IconDiscount2 size={36} stroke={1.5} />
            <Stack gap={4}>
              <Title order={3} fz={20}>Run a promotion</Title>
              <Text c="dimmed" size="sm">Offer a discount with a promo code, a shareable link, or automatically for a limited time. You choose which tickets it covers and how many can be discounted.</Text>
            </Stack>
            {canManage && (
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" w="100%">
                <Template href={`/events/${eventId}/offers/new?template=percent`} icon={<IconPercentage size={20} />} title="Percentage code" text="e.g. SUMMER20 for 20% off" />
                <Template href={`/events/${eventId}/offers/new?template=fixed`} icon={<IconTicket size={20} />} title="Fixed-amount code" text="e.g. 10 off each ticket" />
                <Template href={`/events/${eventId}/offers/new?template=automatic`} icon={<IconBolt size={20} />} title="Automatic sale" text="Applies without a code" />
              </SimpleGrid>
            )}
          </Stack>
        </Card>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Header eventId={eventId} canManage={canManage} />
      <SegmentedControl
        value={filter}
        onChange={(v) => setFilter(v as Filter)}
        data={[
          { value: "ALL", label: `All (${all.length})` },
          { value: "ACTIVE", label: `Active (${count("ACTIVE")})` },
          { value: "DRAFT", label: `Draft (${count("DRAFT")})` },
          { value: "PAUSED", label: `Paused (${count("PAUSED")})` },
          { value: "ENDED", label: `Ended (${count("ENDED")})` },
        ]}
        style={{ alignSelf: "flex-start", maxWidth: "100%", overflowX: "auto" }}
        aria-label="Filter offers by status"
      />

      <Card withBorder radius="lg" p={0}>
        <TableScrollShadow minWidth={760}>
          <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Offer</Table.Th>
                <Table.Th>Discount</Table.Th>
                <Table.Th>Schedule</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th w={190}>Tickets discounted</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visible.length === 0 && (
                <Table.Tr><Table.Td colSpan={5}><Text c="dimmed" size="sm" ta="center" py="md">No {filter.toLowerCase()} offers.</Text></Table.Td></Table.Tr>
              )}
              {visible.map((offer) => {
                const limit = offer.global_ticket_limit;
                const pct = limit ? Math.min(100, Math.round((offer.consumed_ticket_units / limit) * 100)) : null;
                return (
                  <Table.Tr key={offer.id}>
                    <Table.Td>
                      <UnstyledButton component={Link} href={`/events/${eventId}/offers/${offer.id}`}>
                        <Text fw={600} size="sm">{offer.name}</Text>
                      </UnstyledButton>
                      <Group gap={6} mt={2}>
                        <Badge size="xs" variant="outline" color="gray">{offer.activation === "CODE" ? "Code" : "Automatic"}</Badge>
                        {offer.activation === "CODE" && offer.code && <Text size="xs" c="dimmed" ff="monospace">{offer.code}</Text>}
                      </Group>
                    </Table.Td>
                    <Table.Td><Text size="sm">{discountLabel(offer)}</Text></Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatEventDate(offer.starts_at, timezone)} – {formatEventDate(offer.ends_at, timezone)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={STATUS_COLOR[offer.status]} variant="light">{STATUS_LABEL[offer.status]}</Badge>
                      {offer.status === "ACTIVE" && !offer.is_currently_eligible && <Text size="xs" c="dimmed" mt={2}>Outside its dates</Text>}
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        <Text size="sm" fw={500}>{offer.consumed_ticket_units}{limit ? ` / ${limit}` : ""}</Text>
                        {pct !== null && (
                          <Progress value={pct} size="sm" radius="xl" color={pct >= 80 ? "orange" : undefined}
                            aria-label={`${offer.consumed_ticket_units} of ${limit} tickets used`} />
                        )}
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </TableScrollShadow>
      </Card>
    </Stack>
  );
}

function Header({ eventId, canManage }: { eventId: number; canManage: boolean }) {
  return (
    <Group justify="space-between" align="flex-start" wrap="wrap">
      <Stack gap={2}>
        <Title order={2} fz={24}>Offers</Title>
        <Text size="sm" c="dimmed">Discount codes, share links and automatic sales for this event.</Text>
      </Stack>
      {canManage && <Button component={Link} href={`/events/${eventId}/offers/new`} leftSection={<IconPlus size={16} />}>Create offer</Button>}
    </Group>
  );
}

function Template({ href, icon, title, text }: { href: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Card withBorder radius="md" p="md" component={Link} href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <Stack gap={6} align="center">
        {icon}
        <Text fw={600} size="sm">{title}</Text>
        <Text size="xs" c="dimmed">{text}</Text>
      </Stack>
    </Card>
  );
}
