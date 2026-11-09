import { notFound } from "next/navigation";
import { Stack } from "@mantine/core";
import { backendRequest } from "@/lib/backend";
import type { Event } from "@/lib/eventApi";
import type { Bundle, Product } from "@/lib/productApi";
import type { TicketLayoutResponse } from "@/lib/ticketLayoutApi";
import type { Question } from "@/lib/questionApi";
import { EventManager } from "@/components/EventManager";
import { getCurrentOrganization } from "@/lib/session";
import type { ComplimentaryProgram } from "@/lib/complimentaryApi";

export default async function EventSettingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const [eventResult, productsResult, questionsResult, complimentaryResult, layoutResult, bundlesResult, organization] = await Promise.all([
    backendRequest<{ event: Event }>(`/api/events/${eventId}`),
    backendRequest<{ products: Product[]; bundles_enabled?: boolean }>(`/api/events/${eventId}/products`),
    backendRequest<{ questions: Question[] }>(`/api/events/${eventId}/questions`),
    backendRequest<{ program: ComplimentaryProgram }>(`/api/events/${eventId}/complimentary-program`),
    // Fetched here, not after hydration, so the ticket list and preview are on screen with the page. A failure
    // just leaves them to the client (which then lists the tickets plainly and offers a retry).
    backendRequest<TicketLayoutResponse>(`/api/events/${eventId}/ticket-layout`),
    backendRequest<{ bundles: Bundle[] }>(`/api/events/${eventId}/bundles`),
    getCurrentOrganization(),
  ]);
  if (eventResult.status !== 200) notFound();
  return (
    <Stack gap="xl" maw={1000}>
      <EventManager
        initialEvent={eventResult.data.event}
        initialProducts={productsResult.status === 200 ? productsResult.data.products : []}
        bundlesEnabled={productsResult.status === 200 ? Boolean(productsResult.data.bundles_enabled) : false}
        initialTicketLayout={layoutResult.status === 200 ? layoutResult.data : null}
        initialBundles={bundlesResult.status === 200 ? bundlesResult.data.bundles : undefined}
        initialQuestions={questionsResult.status === 200 ? questionsResult.data.questions : []}
        initialComplimentaryProgram={complimentaryResult.data.program}
        organizationSlug={organization?.slug ?? ""}
      />
    </Stack>
  );
}
