"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Checkbox, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconCircleCheck } from "@tabler/icons-react";
import type { AcceptPreview } from "@/lib/acceptApi";
import { submitAccept } from "@/lib/acceptApi";
import { resolveApiErrorMessage } from "@/lib/apiErrorMessages";

export function AcceptForm({ preview }: { preview: AcceptPreview }) {
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () => submitAccept(),
    onError: (e) => setError(resolveApiErrorMessage(e)),
  });

  if (submit.isSuccess) {
    return (
      <Stack gap="md" align="center" ta="center">
        <ThemeIcon size={56} radius="xl" color="teal" variant="light">
          <IconCircleCheck size={32} />
        </ThemeIcon>
        <Title order={2} fz={22}>
          Your spot is confirmed
        </Title>
        <Text c="dimmed" size="sm">
          Your ticket for {preview.event.title} is now valid. Check your email for it.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Title order={2} fz={22}>
          {preview.attendee_first_name ? `${preview.attendee_first_name}, confirm your spot` : "Confirm your spot"}
        </Title>
        <Text c="dimmed" size="sm">
          {preview.inviter_name ? `${preview.inviter_name} gave you a ticket to ` : "You have a ticket to "}
          {preview.event.title}
          {preview.ticket.name ? ` · ${preview.ticket.name}` : ""}.
        </Text>
      </Stack>

      {error && (
        <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Checkbox
        checked={agreed}
        onChange={(e) => setAgreed(e.currentTarget.checked)}
        label="I accept the admission terms for this event."
      />

      <Button onClick={() => submit.mutate()} loading={submit.isPending} disabled={!agreed} size="md">
        Confirm my spot
      </Button>
    </Stack>
  );
}
