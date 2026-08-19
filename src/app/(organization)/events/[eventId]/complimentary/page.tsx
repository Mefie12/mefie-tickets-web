import { notFound } from "next/navigation";
import { backendRequest } from "@/lib/backend";
import type { ComplimentaryProgram } from "@/lib/complimentaryApi";
import type { Product } from "@/lib/productApi";
import type { Question } from "@/lib/questionApi";
import { ComplimentaryTicketsManager } from "@/components/ComplimentaryTicketsManager";

export default async function ComplimentaryTicketsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const [program, products, questions] = await Promise.all([
    backendRequest<{ program: ComplimentaryProgram }>(`/api/events/${eventId}/complimentary-program`),
    backendRequest<{ products: Product[] }>(`/api/events/${eventId}/products`),
    backendRequest<{ questions: Question[] }>(`/api/events/${eventId}/questions`),
  ]);
  if (program.status === 404) notFound();
  if (!program.ok || !products.ok || !questions.ok) throw new Error("Unable to load complimentary tickets.");
  return <ComplimentaryTicketsManager eventId={Number(eventId)} initialProgram={program.data.program} products={products.data.products} questions={questions.data.questions} />;
}
