"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Badge, Group, Progress, Stack, Tabs, Text, Title } from "@mantine/core";
import { IconAlertTriangle, IconCircleCheck, IconQrcode, IconSearch } from "@tabler/icons-react";
import { ApiError } from "@/lib/authApi";
import {
  gateCheckInByAttendee,
  gateCheckInByToken,
  gateUndoCheckIn,
  getGateRoster,
  type GateCapability,
  type GateCheckInResult,
  type GateRosterPayload,
} from "@/lib/gateApi";
import { clearGateSession } from "@/lib/gateSession";
import { resolveApiErrorMessage } from "@/lib/apiErrorMessages";
import { QrScanner } from "@/components/QrScanner";
import { AttendeeSearch } from "@/components/AttendeeSearch";
import { CheckInActivityFeed } from "@/components/CheckInActivityFeed";

type ScanResult = { type: "success" | "error"; message: string } | null;

// A code still in the camera's view would fire onScan repeatedly — this
// cooldown ignores further scans while a result is on screen.
const RESULT_COOLDOWN_MS = 2500;

export function GateCheckIn({
  shortId,
  capabilities,
  initialData,
}: {
  shortId: string;
  capabilities: GateCapability[];
  initialData?: GateRosterPayload;
}) {
  const router = useRouter();
  const [result, setResult] = useState<ScanResult>(null);
  const cooldownRef = useRef(false);
  const canUndo = capabilities.includes("undo");

  const query = useQuery({
    queryKey: ["gate-roster", shortId],
    queryFn: () => getGateRoster(shortId),
    initialData,
    refetchInterval: 15000,
  });

  function onAuthError(error: unknown) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 419)) {
      clearGateSession();
      router.replace("/gate");
      return true;
    }
    return false;
  }

  function showResult(next: ScanResult) {
    setResult(next);
    cooldownRef.current = true;
    setTimeout(() => {
      cooldownRef.current = false;
      setResult(null);
    }, RESULT_COOLDOWN_MS);
  }

  const checkInMutation = useMutation({
    mutationFn: (payload: { lookupToken?: string; attendeeShortId?: string }) =>
      payload.lookupToken
        ? gateCheckInByToken(shortId, payload.lookupToken)
        : gateCheckInByAttendee(shortId, payload.attendeeShortId!),
    onSuccess: (data: GateCheckInResult) => {
      showResult({ type: "success", message: `${data.attendee.first_name} ${data.attendee.last_name} checked in` });
      query.refetch();
    },
    onError: (error: Error) => {
      if (onAuthError(error)) return;
      showResult({ type: "error", message: resolveApiErrorMessage(error) });
    },
  });

  const undoMutation = useMutation({
    mutationFn: (checkInShortId: string) => gateUndoCheckIn(shortId, checkInShortId),
    onSuccess: () => query.refetch(),
    onError: (error: Error) => {
      if (onAuthError(error)) return;
      showResult({ type: "error", message: resolveApiErrorMessage(error) });
    },
  });

  const data = query.data;
  if (!data) return null;

  const isBusy = checkInMutation.isPending || undoMutation.isPending;

  function handleScan(decodedText: string) {
    if (cooldownRef.current || checkInMutation.isPending) return;
    checkInMutation.mutate({ lookupToken: decodedText });
  }

  return (
    <Stack gap="xl" maw={560} mx="auto" p="md">
      <Stack gap={0}>
        <Text size="sm" c="dimmed">
          {data.check_in_list.event_title}
        </Text>
        <Title order={2} fz={28}>
          {data.check_in_list.name}
        </Title>
      </Stack>

      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600}>
            {data.stats.checked_in} / {data.stats.total} checked in
          </Text>
          <Badge color="gray" variant="light">
            {data.stats.remaining} remaining
          </Badge>
        </Group>
        <Progress
          value={data.stats.total > 0 ? (data.stats.checked_in / data.stats.total) * 100 : 0}
          size="lg"
          radius="xl"
        />
      </Stack>

      {result && (
        <Alert
          color={result.type === "success" ? "teal" : "red"}
          icon={result.type === "success" ? <IconCircleCheck /> : <IconAlertTriangle />}
          title={result.type === "success" ? "Checked in" : "Not checked in"}
          role="status"
          aria-live="assertive"
        >
          {result.message}
        </Alert>
      )}

      <Tabs defaultValue="scan">
        <Tabs.List grow>
          <Tabs.Tab value="scan" leftSection={<IconQrcode size={16} />}>
            Scan
          </Tabs.Tab>
          <Tabs.Tab value="search" leftSection={<IconSearch size={16} />}>
            Search
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="scan" pt="md">
          <QrScanner onScan={handleScan} />
        </Tabs.Panel>

        <Tabs.Panel value="search" pt="md">
          <AttendeeSearch
            attendees={data.attendees}
            isBusy={isBusy}
            onCheckIn={(attendeeShortId) => checkInMutation.mutate({ attendeeShortId })}
            onUndo={canUndo ? (checkInShortId) => undoMutation.mutate(checkInShortId) : undefined}
          />
        </Tabs.Panel>
      </Tabs>

      <Stack gap="xs">
        <Title order={4} fz={16}>
          Recent activity
        </Title>
        <CheckInActivityFeed
          checkIns={data.recent_check_ins}
          timezone={data.check_in_list.event_timezone}
          isBusy={isBusy}
          onUndo={canUndo ? (checkInShortId) => undoMutation.mutate(checkInShortId) : undefined}
        />
      </Stack>
    </Stack>
  );
}
