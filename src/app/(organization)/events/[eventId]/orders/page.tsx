import { notFound } from "next/navigation";
import { Stack, Title } from "@mantine/core";
import { backendRequest } from "@/lib/backend";
import type { Event } from "@/lib/eventApi";
import type { OrderListResponse } from "@/lib/orderApi";
import type { AttendeeListResponse } from "@/lib/attendeeApi";
import { OrdersAttendeesTable } from "@/components/OrdersAttendeesTable";

export default async function OrdersAndAttendeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { eventId } = await params;
  const { view: viewParam } = await searchParams;
  const view = viewParam === "attendees" ? "attendees" : "orders";

  const [eventResult, listResult] = await Promise.all([
    backendRequest<{ event: Event }>(`/api/events/${eventId}`),
    backendRequest<OrderListResponse | AttendeeListResponse>(
      `/api/events/${eventId}/${view === "attendees" ? "attendees" : "orders"}?page=1`,
    ),
  ]);

  if (eventResult.status !== 200) notFound();
  const event = eventResult.data.event;
  const initial = listResult.status === 200 ? listResult.data : null;

  return (
    <Stack gap="lg">
      <Title order={2} fz={28}>
        Orders &amp; Attendees
      </Title>
      <OrdersAttendeesTable
        eventId={Number(eventId)}
        timezone={event.timezone}
        initialView={view}
        initialOrders={view === "orders" ? (initial as OrderListResponse | null) : null}
        initialAttendees={view === "attendees" ? (initial as AttendeeListResponse | null) : null}
      />
    </Stack>
  );
}
