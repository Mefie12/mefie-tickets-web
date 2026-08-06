import { Badge, Container, Group, Stack, Text } from "@mantine/core";
import { IconTicket } from "@tabler/icons-react";
import { SystemStatusCard } from "@/components/SystemStatusCard";

export default function Home() {
  return (
    <Container size="sm" py={80}>
      <Stack gap="xl">
        <Stack gap={4}>
          <Group gap="xs">
            <IconTicket size={22} />
            <Text size="sm" c="dimmed" fw={500}>
              Mefie Tickets
            </Text>
            <Badge variant="light" color="brand" ml="auto">
              Milestone 0
            </Badge>
          </Group>
          <Text
            component="h1"
            fz={40}
            fw={800}
            lh={1.15}
            variant="gradient"
            gradient={{ from: "brand.4", to: "grape.5", deg: 135 }}
          >
            Environment &amp; Architecture Setup
          </Text>
          <Text c="dimmed" maw={520}>
            This placeholder screen exists to prove the frontend build works end
            to end — real UI design lands with Milestone 4 onward. What matters
            here is the chain underneath it: Next.js BFF talking to the Laravel
            API.
          </Text>
        </Stack>

        <SystemStatusCard />
      </Stack>
    </Container>
  );
}
