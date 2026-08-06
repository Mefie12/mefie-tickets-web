import Link from "next/link";
import {
  Avatar,
  Button,
  Card,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconBuildingStore, IconPlus } from "@tabler/icons-react";
import { backendRequest } from "@/lib/backend";
import type { Organizer } from "@/lib/organizerApi";

export default async function OrganizersPage() {
  const result = await backendRequest<{ organizers: Organizer[] }>("/api/organizers");
  const organizers = result.status === 200 ? result.data.organizers : [];

  return (
    <Stack gap="xl" maw={720}>
      <Group justify="space-between">
        <Title order={2} fz={28}>
          Organizers
        </Title>
        <Button component={Link} href="/organizers/new" leftSection={<IconPlus size={16} />}>
          Create organizer
        </Button>
      </Group>

      {organizers.length === 0 ? (
        <Card withBorder radius="lg" p="xl">
          <Stack align="center" gap="xs" py="lg">
            <IconBuildingStore size={32} opacity={0.5} />
            <Text c="dimmed" ta="center">
              No organizers yet. Create one to start setting up events.
            </Text>
          </Stack>
        </Card>
      ) : (
        <Stack gap="sm">
          {organizers.map((organizer) => (
            <Card
              key={organizer.id}
              component={Link}
              href={`/organizers/${organizer.id}`}
              withBorder
              radius="lg"
              p="md"
              style={{ textDecoration: "none" }}
            >
              <Group>
                <Avatar src={organizer.logo_url} radius="lg" size="md" color="brand">
                  {organizer.name[0]}
                </Avatar>
                <Stack gap={0}>
                  <Text fw={600} c="var(--mantine-color-text)">
                    {organizer.name}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {organizer.email}
                  </Text>
                </Stack>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
