"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import {
  IconCircleCheck,
  IconServer,
  IconServer2,
  IconAlertTriangle,
} from "@tabler/icons-react";

type HealthResponse = {
  frontend: "ok";
  backend: { status: string; service?: string; timestamp?: string } | null;
  backendError?: string;
};

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/health", { cache: "no-store" });
  if (!res.ok) throw new Error("Health check request failed");
  return res.json();
}

/**
 * Live proof of the BFF chain described in
 * 00_mefie_tickets_system_architecture.md: this card calls our own
 * Route Handler (/api/health), which calls the Laravel API server-side.
 * Until the backend is bootstrapped, it shows an honest "not reachable"
 * state rather than pretending everything is wired up.
 */
export function SystemStatusCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 15_000,
  });

  return (
    <Card withBorder padding="lg" radius="lg" shadow="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={600}>System Status</Text>
          {isLoading && <Loader size="xs" />}
        </Group>

        <Group gap="xs">
          <ThemeIcon color="teal" variant="light" size="lg" radius="lg">
            <IconCircleCheck size={18} />
          </ThemeIcon>
          <Text size="sm">Frontend (Next.js BFF)</Text>
          <Badge color="teal" variant="light" ml="auto">
            online
          </Badge>
        </Group>

        <Group gap="xs">
          <ThemeIcon
            color={data?.backend ? "teal" : "yellow"}
            variant="light"
            size="lg"
            radius="lg"
          >
            {data?.backend ? (
              <IconServer2 size={18} />
            ) : (
              <IconServer size={18} />
            )}
          </ThemeIcon>
          <Text size="sm">Backend (Laravel API)</Text>
          <Badge
            color={data?.backend ? "teal" : "yellow"}
            variant="light"
            ml="auto"
          >
            {isLoading ? "checking…" : data?.backend ? "online" : "not connected"}
          </Badge>
        </Group>

        {isError && (
          <Group gap="xs">
            <ThemeIcon color="red" variant="light" size="lg" radius="lg">
              <IconAlertTriangle size={18} />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Couldn&apos;t reach the health-check route itself.
            </Text>
          </Group>
        )}

        {!isLoading && !data?.backend && (
          <Text size="xs" c="dimmed">
            {data?.backendError ??
              "Bring up mefie-tickets-api locally and set API_URL to see this go green."}
          </Text>
        )}
      </Stack>
    </Card>
  );
}
