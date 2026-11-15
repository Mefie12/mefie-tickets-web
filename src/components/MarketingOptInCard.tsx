"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, Card, Stack, Switch, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";

/**
 * The organizer's own, optional checkbox asking buyers whether they may email and text them about future events.
 * Deliberately separate from the Terms & Conditions: it is always unticked, never required, and each order
 * keeps the exact wording its buyer saw. Mefie Tickets does not send these emails; the organizer does.
 */
export function MarketingOptInCard({
  eventId,
  initialEnabled,
  initialLabel,
  disabled,
}: {
  eventId: number;
  initialEnabled: boolean;
  initialLabel: string | null;
  disabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [label, setLabel] = useState(initialLabel ?? "");
  const [saved, setSaved] = useState({ enabled: initialEnabled, label: initialLabel ?? "" });
  const defaultLabel = "Email and text me about upcoming events and offers from [your organization].";

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/events/${eventId}/marketing-opt-in`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, label: label.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(data?.message ?? "Could not save.", res.status, data?.errors, data?.code);
    },
    onSuccess: () => {
      setSaved({ enabled, label });
      notifications.show({ color: "teal", message: "Marketing permission saved." });
    },
    onError: (error: Error) => notifications.show({ color: "red", message: error.message }),
  });

  const dirty = enabled !== saved.enabled || label !== saved.label;

  return (
    <Card withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Title order={5}>Ask buyers for marketing permission</Title>
        <Text size="sm" c="dimmed">
          Adds an optional, unticked checkbox at checkout. Only buyers who tick it can be emailed or texted about your future events. Their choice
          is saved with the order, and they can take it back at any time from their ticket page. Your exports include a column showing who
          currently agrees. You are responsible for including an unsubscribe link in emails, a way to reply STOP to texts, and following local law.
        </Text>
        <Switch checked={enabled} disabled={disabled} onChange={(event) => setEnabled(event.currentTarget.checked)} label="Show the checkbox at checkout" />
        {enabled && (
          <TextInput
            label="Checkbox wording"
            description="Leave empty to use the default, which names your organization. Changing it only affects new orders."
            placeholder={defaultLabel}
            maxLength={300}
            value={label}
            disabled={disabled}
            onChange={(event) => setLabel(event.currentTarget.value)}
          />
        )}
        <Button style={{ alignSelf: "flex-start" }} disabled={disabled || !dirty} loading={save.isPending} onClick={() => save.mutate()}>
          Save
        </Button>
      </Stack>
    </Card>
  );
}
