import { notFound } from "next/navigation";
import { Badge, Box, Button, Flex, Stack, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { getCurrentOrganization, getEventById } from "@/lib/session";
import { EventOperationsNav } from "@/components/EventOperationsNav";
import styles from "./eventLayout.module.css";

export default async function EventOperationsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const [event, organization] = await Promise.all([getEventById(eventId), getCurrentOrganization()]);
  if (!event || !organization) notFound();

  return (
    <Flex gap="xl" align="flex-start" direction={{ base: "column", md: "row" }}>
      <Stack className={styles.nav} gap="lg">
        <Stack gap="xs">
          <Button
            component="a"
            href="/events"
            variant="subtle"
            size="compact-sm"
            leftSection={<IconArrowLeft size={14} />}
            style={{ alignSelf: "flex-start" }}
          >
            Back to events
          </Button>
          <Title order={3} fz={22} lineClamp={2}>
            {event.title}
          </Title>
          <Badge
            color={event.status === "LIVE" ? "teal" : event.status === "DRAFT" ? "gray" : "dark"}
            style={{ alignSelf: "flex-start" }}
          >
            {event.status}
          </Badge>
        </Stack>
        <EventOperationsNav eventId={event.id} />
      </Stack>
      <Box className={styles.content}>{children}</Box>
    </Flex>
  );
}
