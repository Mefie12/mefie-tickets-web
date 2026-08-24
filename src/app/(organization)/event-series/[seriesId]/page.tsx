import { notFound } from "next/navigation";
import { Stack } from "@mantine/core";
import { backendRequest } from "@/lib/backend";
import type { Event } from "@/lib/eventApi";
import type { Product } from "@/lib/productApi";
import type { Question } from "@/lib/questionApi";
import type { EventSeries } from "@/lib/eventSeriesApi";
import { EventSeriesManager } from "@/components/EventSeriesManager";

export default async function EventSeriesSettingsPage({ params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = await params;
  const seriesResult = await backendRequest<{ event_series: EventSeries & { template_event: Event } }>(`/api/event-series/${seriesId}`);
  if (seriesResult.status !== 200) notFound();

  const templateEventId = seriesResult.data.event_series.template_event.id;
  const [productsResult, questionsResult] = await Promise.all([
    backendRequest<{ products: Product[] }>(`/api/events/${templateEventId}/products`),
    backendRequest<{ questions: Question[] }>(`/api/events/${templateEventId}/questions`),
  ]);

  return (
    <Stack gap="xl" maw={1000}>
      <EventSeriesManager
        initialSeries={seriesResult.data.event_series}
        initialTemplateEvent={seriesResult.data.event_series.template_event}
        initialProducts={productsResult.status === 200 ? productsResult.data.products : []}
        initialQuestions={questionsResult.status === 200 ? questionsResult.data.questions : []}
      />
    </Stack>
  );
}
