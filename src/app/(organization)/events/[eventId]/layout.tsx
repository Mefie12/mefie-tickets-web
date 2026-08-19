import { notFound } from "next/navigation";
import { Badge, Button, Group, Stack, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { backendRequest } from "@/lib/backend";
import type { Event } from "@/lib/eventApi";
import { EventOperationsNav } from "@/components/EventOperationsNav";

export default async function EventOperationsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const result = await backendRequest<{ event: Event }>(`/api/events/${eventId}`);
  if (result.status !== 200) notFound();
  const event = result.data.event;

  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Button component="a" href="/events" variant="subtle" size="compact-sm" leftSection={<IconArrowLeft size={14} />} style={{ alignSelf: "flex-start" }}>
          Back to events
        </Button>
        <Group justify="space-between">
          <Title order={2} fz={28}>{event.title}</Title>
          <Badge color={event.status === "LIVE" ? "teal" : event.status === "DRAFT" ? "gray" : "dark"}>{event.status}</Badge>
        </Group>
        <EventOperationsNav eventId={event.id} />
      </Stack>
      {children}
    </Stack>
  );
}
