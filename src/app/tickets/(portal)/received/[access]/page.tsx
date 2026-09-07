import { notFound } from "next/navigation";
import { Anchor, Badge, Stack, Text, Title } from "@mantine/core";
import { backendRequest } from "@/lib/backend";
import { LinkButton } from "@/components/LinkButton";
import { formatEventDateRange } from "@/lib/eventDateTime";
import type { ReceivedTicket } from "@/lib/portalApi";
export default async function ReceivedTicketPage({ params }: { params: Promise<{ access: string }> }) {
  const { access } = await params;
  const result = await backendRequest<ReceivedTicket>(`/api/portal/received/${encodeURIComponent(access)}`);
  if (result.status !== 200) notFound();
  const ticket = result.data;
  return <Stack py="xl"><LinkButton href="/tickets" variant="subtle">Back to My Tickets</LinkButton><Title order={1}>{ticket.event.title}</Title><Text>{ticket.event.start_date ? formatEventDateRange(ticket.event.start_date, null, ticket.event.timezone ?? "UTC") : ""}</Text><Title order={2} size="h3">{ticket.ticket_name}</Title><Text>{ticket.ticket_option}</Text><Text>{ticket.attendee.first_name} {ticket.attendee.last_name}</Text><Text size="sm" c="dimmed">{ticket.ticket_reference}</Text><Badge>{(ticket.commercial_status !== "ACTIVE" ? ticket.commercial_status : ticket.assignment_status).replaceAll("_", " ")}</Badge>{ticket.credential_available ? <Anchor href={`/api/portal/received/${ticket.id}/download`}>Download ticket PDF</Anchor> : <Text c="dimmed">{ticket.reacceptance_required || ticket.assignment_status === "PENDING_ACCEPTANCE" ? "Open your confirmation email to accept the admission terms." : "A valid ticket credential is not available for this ticket."}</Text>}</Stack>;
}
