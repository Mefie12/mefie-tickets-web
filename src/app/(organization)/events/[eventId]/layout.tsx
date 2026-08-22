import { notFound } from "next/navigation";
import { Badge, Button, Group, Stack, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { backendRequest } from "@/lib/backend";
import type { Event } from "@/lib/eventApi";
import type { Organization } from "@/lib/organizationApi";
import { APP_URL } from "@/lib/backend";
import { EventOperationsNav } from "@/components/EventOperationsNav";
import { PublicShareCard } from "@/components/PublicShareCard";

export default async function EventOperationsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const [result, organizationResult] = await Promise.all([
    backendRequest<{ event: Event }>(`/api/events/${eventId}`),
    backendRequest<{ organization: Organization | null }>("/api/organization"),
  ]);
  if (result.status !== 200 || organizationResult.status !== 200 || !organizationResult.data.organization) notFound();
  const event = result.data.event;
  const organization = organizationResult.data.organization;
  const isLive = event.status === "LIVE";

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
      <PublicShareCard
        heading="Share this event"
        variant="compact"
        url={`${APP_URL}/${organization.slug}/${event.slug}`}
        title={event.title}
        text={`View ${event.title} and get tickets.`}
        enabled={isLive}
        disabledExplanation={event.status === "DRAFT" ? "This is the future public URL. Sharing becomes available after publication." : "Archived events are not publicly shareable. Restore and publish the event to enable sharing."}
      />
      {children}
    </Stack>
  );
}
