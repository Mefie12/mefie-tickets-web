"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, Center, Group, Loader, NumberInput, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { getPlatformSettings, resetReservationHoldMinutes, setReservationHoldMinutes } from "@/lib/platformSettingsAdminApi";

/**
 * Runtime overrides of otherwise config/env-defined values. Only the
 * checkout reservation hold exists today; a future setting gets its own
 * card here the same way — see PlatformSettingService on the backend.
 */
export default function PlatformSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["platform-settings"], queryFn: getPlatformSettings });
  const [minutes, setMinutes] = useState<number | "">("");

  const setting = query.data?.reservation_hold_minutes;

  function handleError(error: Error) {
    if (redirectOnAuthError(error, router)) return;
    notifications.show({ color: "red", message: error instanceof ApiError ? error.message : "Something went wrong." });
  }

  const saveMutation = useMutation({
    mutationFn: (value: number) => setReservationHoldMinutes(value),
    onSuccess: () => {
      notifications.show({ color: "teal", message: "Reservation hold updated." });
      setMinutes("");
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
    },
    onError: handleError,
  });

  const resetMutation = useMutation({
    mutationFn: resetReservationHoldMinutes,
    onSuccess: () => {
      notifications.show({ color: "teal", message: "Reservation hold reset to the system default." });
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
    },
    onError: handleError,
  });

  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={2}>Platform Settings</Title>
        <Text c="dimmed">Runtime overrides of system-wide checkout behaviour, without a redeploy.</Text>
      </Stack>

      {query.isLoading ? (
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      ) : setting ? (
        <Card withBorder radius="lg" p="lg" maw={480}>
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={600}>Reservation hold</Text>
              <Badge color={setting.is_override ? "teal" : "gray"}>{setting.is_override ? "Overridden" : "System default"}</Badge>
            </Group>
            <Text size="sm" c="dimmed">
              How long a checkout reservation holds inventory before it&apos;s released back for sale. Currently{" "}
              <strong>{setting.value} minute{setting.value === 1 ? "" : "s"}</strong>
              {setting.is_override && ` (system default is ${setting.default}).`}
            </Text>
            <Group align="flex-end">
              <NumberInput
                label="New value (minutes)"
                min={1}
                max={120}
                value={minutes}
                onChange={(value) => setMinutes(typeof value === "number" ? value : "")}
                w={160}
              />
              <Button
                onClick={() => typeof minutes === "number" && saveMutation.mutate(minutes)}
                loading={saveMutation.isPending}
                disabled={typeof minutes !== "number"}
              >
                Save
              </Button>
              {setting.is_override && (
                <Button variant="default" onClick={() => resetMutation.mutate()} loading={resetMutation.isPending}>
                  Reset to default
                </Button>
              )}
            </Group>
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
}
