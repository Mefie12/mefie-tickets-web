import { notFound } from "next/navigation";
import { backendRequest } from "@/lib/backend";
import type { Event } from "@/lib/eventApi";
import type { Product } from "@/lib/productApi";
import type { GateConfiguration } from "@/lib/gateRoutingApi";
import { GateRoutingManager } from "@/components/GateRoutingManager";

export default async function GatesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const [eventResult, productResult, gateResult] = await Promise.all([
    backendRequest<{ event: Event }>(`/api/events/${eventId}`),
    backendRequest<{ products: Product[] }>(`/api/events/${eventId}/products`),
    backendRequest<GateConfiguration>(`/api/events/${eventId}/gates`),
  ]);
  if (eventResult.status !== 200 || gateResult.status !== 200) notFound();
  return <GateRoutingManager eventId={Number(eventId)} eventStatus={eventResult.data.event.status}
    products={productResult.status === 200 ? productResult.data.products : []}
    productLoadError={productResult.status !== 200} initial={gateResult.data}/>;
}
