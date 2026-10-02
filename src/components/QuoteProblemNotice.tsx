"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Group, Text } from "@mantine/core";
import { IconCloudOff } from "@tabler/icons-react";
import type { QuoteProblem } from "@/lib/quoteProblem";

/**
 * Shown when a price quote could not be fetched. Deliberately not the red "Code not applied" alert: the
 * code may be perfectly good, we just couldn't ask. The price on screen may be missing the discount, and
 * the order step re-checks everything, so nothing here blocks the buyer.
 */
export function QuoteProblemNotice({ problem, retryAt, retrying, onRetry }: {
  problem: QuoteProblem | null;
  retryAt: number | null;
  retrying: boolean;
  onRetry: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (problem !== "RATE_LIMITED" || retryAt === null) return;
    const handle = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(handle);
  }, [problem, retryAt]);

  if (!problem) return null;
  const seconds = retryAt === null ? 0 : Math.max(0, Math.ceil((retryAt - now) / 1000));

  return (
    <Alert color="yellow" variant="light" icon={<IconCloudOff size={18} />} role="status" title="Couldn’t check your discount">
      <Group justify="space-between" align="center" gap="xs" wrap="wrap">
        <Text size="sm" style={{ flex: "1 1 220px" }}>
          {problem === "RATE_LIMITED"
            ? `Lots of people are checking prices right now. The price shown may not include your discount yet${seconds > 0 ? ` — trying again in ${seconds}s.` : " — trying again now."}`
            : "The price shown may not include your discount. Your code is still saved."}
        </Text>
        <Button size="compact-sm" variant="default" onClick={onRetry} loading={retrying}>{problem === "RATE_LIMITED" ? "Try now" : "Try again"}</Button>
      </Group>
    </Alert>
  );
}
