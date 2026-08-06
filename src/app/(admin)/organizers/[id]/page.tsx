import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card, Group, Stack, Text } from "@mantine/core";
import { IconCalendarEvent } from "@tabler/icons-react";
import { backendRequest } from "@/lib/backend";
import { getCurrentUser } from "@/lib/session";
import type { Organizer } from "@/lib/organizerApi";
import type { OrganizerPayoutSummary } from "@/lib/organizerPayoutApi";
import { OrganizerSettingsForm } from "@/components/OrganizerSettingsForm";
import { OrganizerPayoutCard } from "@/components/OrganizerPayoutCard";

export default async function OrganizerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [result, payoutsResult, user] = await Promise.all([
    backendRequest<{ organizer: Organizer }>(`/api/organizers/${id}`),
    backendRequest<OrganizerPayoutSummary>(`/api/organizers/${id}/payouts`),
    getCurrentUser(),
  ]);

  if (result.status !== 200 || !user) {
    notFound();
  }

  return (
    <Stack gap="xl" maw={640}>
      <Card withBorder radius="lg" p="md">
        <Group justify="space-between">
          <Group gap="xs">
            <IconCalendarEvent size={20} />
            <Text fw={600}>Events</Text>
          </Group>
          <Button component={Link} href={`/organizers/${id}/events`} variant="light" size="xs">
            Manage events
          </Button>
        </Group>
      </Card>
      <OrganizerSettingsForm initialOrganizer={result.data.organizer} canEdit={user.role === "ADMIN"} />
      {payoutsResult.status === 200 && <OrganizerPayoutCard summary={payoutsResult.data} />}
    </Stack>
  );
}
