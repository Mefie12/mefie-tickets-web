import { Title, Stack } from "@mantine/core";
import { QuestionResponses } from "@/components/QuestionResponses";

export default async function ResponsesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <Stack gap="lg"><Title order={2} fz={28}>Question responses</Title><QuestionResponses eventId={Number(eventId)} /></Stack>;
}
