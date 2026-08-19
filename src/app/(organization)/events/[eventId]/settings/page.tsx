import { notFound } from "next/navigation";
import { Stack } from "@mantine/core";
import { backendRequest } from "@/lib/backend";
import type { Event } from "@/lib/eventApi";
import type { Product } from "@/lib/productApi";
import type { Question } from "@/lib/questionApi";
import { EventManager } from "@/components/EventManager";
import type { ComplimentaryProgram } from "@/lib/complimentaryApi";

export default async function EventSettingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const [eventResult, productsResult, questionsResult, complimentaryResult] = await Promise.all([
    backendRequest<{ event: Event }>(`/api/events/${eventId}`),
    backendRequest<{ products: Product[] }>(`/api/events/${eventId}/products`),
    backendRequest<{ questions: Question[] }>(`/api/events/${eventId}/questions`),
    backendRequest<{ program: ComplimentaryProgram }>(`/api/events/${eventId}/complimentary-program`),
  ]);
  if (eventResult.status !== 200) notFound();
  return <Stack gap="xl" maw={1000}><EventManager initialEvent={eventResult.data.event} initialProducts={productsResult.status === 200 ? productsResult.data.products : []} initialQuestions={questionsResult.status === 200 ? questionsResult.data.questions : []} initialComplimentaryProgram={complimentaryResult.data.program} /></Stack>;
}
