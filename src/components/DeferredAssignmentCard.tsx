"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Card, Group, Select, Stack, Switch, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { updateDeferredAssignment, type AcceptancePolicy, type Event } from "@/lib/eventApi";
import { resolveApiErrorMessage } from "@/lib/apiErrorMessages";

const POLICY_OPTIONS: { value: AcceptancePolicy; label: string; description: string }[] = [
  {
    value: "PURCHASER_GROUP",
    label: "Buyer assigns everyone",
    description: "The buyer names each attendee from their account. Optional inline entry at checkout.",
  },
  {
    value: "ATTENDEE_PERSONAL",
    label: "Each attendee confirms",
    description: "The buyer sends a link; each attendee personally accepts the admission terms before their ticket is valid.",
  },
  {
    value: "GUARDIAN_MINOR",
    label: "Guardian accepts for a minor",
    description: "A guardian accepts on the attendee's behalf.",
  },
];

/**
 * Organizer opt-in for buy-now-assign-later (docs/17 §7.1, §19).
 * Backed by PATCH /events/{id}/deferred-assignment — a dedicated
 * endpoint with its own guards (paid tickets only; can't disable while
 * buyers have unassigned tickets).
 */
export function DeferredAssignmentCard({ eventId, event }: { eventId: number; event: Event }) {
  const [enabled, setEnabled] = useState(event.deferred_assignment_enabled);
  const [policy, setPolicy] = useState<AcceptancePolicy>(
    (event.acceptance_policy as AcceptancePolicy | null) ?? "PURCHASER_GROUP",
  );
  const [closesAt, setClosesAt] = useState(event.admission_closes_at?.slice(0, 10) ?? "");
  const [effective, setEffective] = useState<boolean>(event.deferred_assignment_enabled);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (next: {
      enabled: boolean;
      acceptance_policy?: AcceptancePolicy;
      admission_closes_at?: string | null;
    }) => updateDeferredAssignment(eventId, next),
    onSuccess: (res) => {
      setEnabled(res.event.deferred_assignment_enabled);
      setEffective(res.deferred_assignment_effective);
      setPolicy((res.event.acceptance_policy as AcceptancePolicy | null) ?? policy);
      setError(null);
      notifications.show({ color: "teal", message: "Ticket assignment settings saved." });
    },
    onError: (e, vars) => {
      // Revert the optimistic switch to what it was before this attempt.
      setEnabled(!vars.enabled);
      setError(resolveApiErrorMessage(e));
    },
  });

  function toggle(nextEnabled: boolean) {
    setEnabled(nextEnabled); // optimistic; onSuccess/onError reconcile
    save.mutate(
      nextEnabled
        ? {
            enabled: true,
            acceptance_policy: policy,
            admission_closes_at: closesAt ? new Date(`${closesAt}T23:59:59`).toISOString() : null,
          }
        : { enabled: false },
    );
  }

  function saveDetails(nextPolicy: AcceptancePolicy, nextClosesAt: string) {
    save.mutate({
      enabled: true,
      acceptance_policy: nextPolicy,
      admission_closes_at: nextClosesAt ? new Date(`${nextClosesAt}T23:59:59`).toISOString() : null,
    });
  }

  return (
    <Card withBorder radius="lg" p="lg" maw={640}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Title order={4} fz={18}>
              Buy now, assign later
            </Title>
            <Text size="sm" c="dimmed">
              Let buyers pay without naming attendees, then assign each ticket — or send an invite link — from their
              account.
            </Text>
          </Stack>
          <Switch
            checked={enabled}
            onChange={(e) => toggle(e.currentTarget.checked)}
            disabled={save.isPending}
            aria-label="Enable buy now, assign later"
          />
        </Group>

        {error && (
          <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {enabled && !effective && !error && (
          <Alert color="yellow" variant="light">
            Saved — but this feature isn&apos;t switched on across the platform yet, so checkout still asks for attendee
            details for now.
          </Alert>
        )}

        {enabled && (
          <Stack gap="sm">
            <Select
              label="How is admission accepted?"
              data={POLICY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={policy}
              onChange={(v) => {
                if (!v) return;
                setPolicy(v as AcceptancePolicy);
                saveDetails(v as AcceptancePolicy, closesAt);
              }}
              allowDeselect={false}
            />
            <Text size="xs" c="dimmed">
              {POLICY_OPTIONS.find((o) => o.value === policy)?.description}
            </Text>
            <TextInput
              type="date"
              label="Assignment closes (optional)"
              description="After this date buyers can no longer assign tickets"
              value={closesAt}
              onChange={(e) => setClosesAt(e.currentTarget.value)}
              onBlur={() => saveDetails(policy, closesAt)}
            />
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
