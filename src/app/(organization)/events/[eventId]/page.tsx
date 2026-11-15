import { notFound, redirect } from "next/navigation";
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
import { APP_URL, backendRequest } from "@/lib/backend";
import { getCurrentOrganization, getEventById } from "@/lib/session";
import { formatAmount, formatMinorAmount } from "@/lib/money";
import type { EventOverview } from "@/lib/overviewApi";
import { PublicShareCard } from "@/components/PublicShareCard";

export default async function EventOverviewPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const [result, event, organization] = await Promise.all([
    backendRequest<{ overview: EventOverview }>(`/api/events/${eventId}/overview`),
    getEventById(eventId),
    getCurrentOrganization(),
  ]);
  if (result.status === 404) notFound();
  // A transient auth failure (e.g. the session expiring between the layout's
  // guard and this call) should bounce to login, not blow up with a runtime error.
  if (result.status === 401 || result.status === 419) redirect("/organizers/login");
  if (result.status !== 200) throw new Error("Unable to load event overview.");
  const overview = result.data.overview;
  const attention = overview.requires_attention?.unanswered_required_attendee_questions;

  return (
    <Stack gap="xl">
      {event && organization && (
        <PublicShareCard
          heading="Share this event"
          variant="compact"
          url={`${APP_URL}/${organization.slug}/${event.slug}`}
          title={event.title}
          text={`View ${event.title} and get tickets.`}
          enabled={event.status === "LIVE"}
          shortLink={{ target: "events", id: event.id, visibility: event.visibility }}
          disabledExplanation={
            event.status === "DRAFT"
              ? "This is the future public URL. Sharing becomes available after publication."
              : "Archived events are not publicly shareable. Restore and publish the event to enable sharing."
          }
        />
      )}
      <Title order={3}>Overview</Title>
      {attention !== undefined && attention > 0 && <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="Requires attention">{attention} confirmed attendee{attention === 1 ? " has" : "s have"} unanswered required registration questions.</Alert>}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <Stat
          label="Tickets sold"
          value={String(overview.tickets?.sold ?? overview.attendees.confirmed)}
          help={overview.tickets && overview.tickets.awaiting_names > 0
            ? `${overview.attendees.confirmed} named · ${overview.tickets.awaiting_names} waiting for the buyer to add names`
            : "Excludes pending payments and reservations"}
        />
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
      {(overview.bundle_performance?.length ?? 0) > 0 && (
        <Card withBorder radius="lg" p="lg">
          <Title order={4} mb="md">Bundles</Title>
          <TableScrollContainer minWidth={600}><Table striped><TableThead><TableTr><TableTh>Bundle</TableTh><TableTh>Sold</TableTh><TableTh>Tickets</TableTh><TableTh>Limit</TableTh><TableTh>Revenue</TableTh></TableTr></TableThead><TableTbody>
            {overview.bundle_performance!.map((row) => <TableTr key={row.bundle_id}><TableTd><Text fw={600}>{row.title}</Text><Text size="xs" c="dimmed">{row.tickets_per_bundle} tickets each</Text></TableTd><TableTd>{row.bundles_sold}</TableTd><TableTd>{row.tickets_sold}</TableTd><TableTd>{row.cap ?? "—"}</TableTd><TableTd>{formatMinorAmount(row.revenue_minor, row.currency)}</TableTd></TableTr>)}
          </TableTbody></Table></TableScrollContainer>
          <Text size="xs" c="dimmed" mt="xs">Bundle tickets are also counted under their ticket types above, with the bundle price split across them.</Text>
        </Card>
      )}
    </Stack>
  );
}

function Stat({ label, value, help }: { label: string; value: string; help?: string }) {
  return <Card withBorder radius="lg" p="lg"><Text size="sm" c="dimmed">{label}</Text><Text fw={700} fz={28}>{value}</Text>{help && <Text size="xs" c="dimmed">{help}</Text>}</Card>;
}
