"use client";

import { Anchor, Text } from "@mantine/core";
import { suggestEmailCorrection } from "@/lib/emailAddress";

/** "Did you mean ...?" under an email field when the domain looks like a typo. Suggests only; never blocks. */
export function EmailTypoHint({ email, onUse }: { email: string; onUse: (corrected: string) => void }) {
  const suggestion = suggestEmailCorrection(email);
  if (!suggestion) return null;
  return (
    <Text size="xs" c="dimmed" role="status" style={{ overflowWrap: "anywhere" }}>
      Did you mean <strong>{suggestion}</strong>?{" "}
      <Anchor component="button" type="button" size="xs" onClick={() => onUse(suggestion)}>Use this</Anchor>
    </Text>
  );
}
