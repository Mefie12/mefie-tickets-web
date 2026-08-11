import { notFound } from "next/navigation";
import { Stack } from "@mantine/core";
import { backendRequest } from "@/lib/backend";
import type { Event } from "@/lib/eventApi";
import type { OrderDetail as OrderDetailType } from "@/lib/orderApi";
import { OrderDetail } from "@/components/OrderDetail";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ eventId: string; orderId: string }>;
}) {
  const { eventId, orderId } = await params;

  const [eventResult, orderResult] = await Promise.all([
    backendRequest<{ event: Event }>(`/api/events/${eventId}`),
    backendRequest<{ order: OrderDetailType }>(`/api/events/${eventId}/orders/${orderId}`),
  ]);

  if (eventResult.status !== 200 || orderResult.status !== 200) {
    notFound();
  }

  return (
    <Stack gap="xl" maw={720}>
      <OrderDetail
        eventId={Number(eventId)}
        event={eventResult.data.event}
        initialOrder={orderResult.data.order}
      />
    </Stack>
  );
}
