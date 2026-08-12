import { notFound } from "next/navigation";
import {
  Alert,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Table,
  TableScrollContainer,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
  Title,
} from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { backendRequest } from "@/lib/backend";
import { formatAmount } from "@/lib/money";
import type { EventOverview } from "@/lib/overviewApi";

export default async function EventOverviewPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const result = await backendRequest<{ overview: EventOverview }>(`/api/events/${eventId}/overview`);
  if (result.status === 404) notFound();
  if (result.status !== 200) throw new Error("Unable to load event overview.");
  const overview = result.data.overview;
  const attention = overview.requires_attention?.unanswered_required_attendee_questions;

  return (
    <Stack gap="xl">
      <Title order={3}>Overview</Title>
      {attention !== undefined && attention > 0 && <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="Requires attention">{attention} confirmed attendee{attention === 1 ? " has" : "s have"} unanswered required registration questions.</Alert>}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <Stat label="Confirmed attendees" value={String(overview.attendees.confirmed)} help="Excludes pending payments and reservations" />
        <Stat label="Checked in" value={String(overview.checked_in)} />
        <Stat label="Completed orders" value={String(overview.orders.orders)} />
        <Stat label="Gross customer payments" value={formatAmount(overview.orders.gross_sales, overview.orders.currency)} />
      </SimpleGrid>
      <Card withBorder radius="lg" p="lg">
        <Group justify="space-between" mb="md"><Title order={4}>Ticket performance</Title><Text size="sm" c="dimmed">Event capacity: {overview.capacity.is_unlimited ? "Unlimited" : overview.capacity.capacity}</Text></Group>
        <TableScrollContainer minWidth={700}><Table striped highlightOnHover><TableThead><TableTr><TableTh>Ticket</TableTh><TableTh>Capacity</TableTh><TableTh>Issued</TableTh><TableTh>Remaining</TableTh><TableTh>Revenue</TableTh></TableTr></TableThead><TableTbody>
          {overview.ticket_performance.map((row) => <TableTr key={`${row.row_type}-${row.product_id}-${row.price_tier_id ?? "all"}`}><TableTd><Text fw={row.row_type === "product" ? 600 : 400} pl={row.row_type === "tier" ? "md" : 0}>{row.row_type === "tier" ? `↳ ${row.name}` : row.name}</Text></TableTd><TableTd>{row.is_unlimited ? "Unlimited" : row.capacity}</TableTd><TableTd>{row.issued}</TableTd><TableTd>{row.remaining ?? "Unlimited"}</TableTd><TableTd>{formatAmount(row.revenue, row.currency)}</TableTd></TableTr>)}
        </TableTbody></Table></TableScrollContainer>
      </Card>
    </Stack>
  );
}

function Stat({ label, value, help }: { label: string; value: string; help?: string }) {
  return <Card withBorder radius="lg" p="lg"><Text size="sm" c="dimmed">{label}</Text><Text fw={700} fz={28}>{value}</Text>{help && <Text size="xs" c="dimmed">{help}</Text>}</Card>;
}
