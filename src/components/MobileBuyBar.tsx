"use client";

import { useEffect, useState } from "react";
import { Box, Button, Group, Text } from "@mantine/core";

/**
 * Mobile-only sticky bottom bar (desktop already gets a sticky sidebar —
 * see page.tsx/PublicEventSeriesView.tsx). Scrolls to the existing
 * checkout section rather than duplicating it, since Checkout owns its
 * own wizard state/sessionStorage resume logic and must only ever be
 * mounted once per page. Hides itself once the checkout section is
 * already on screen, so it never sits over an open payment form.
 */
export function MobileBuyBar({
  targetId,
  priceLabel,
  disabled,
}: {
  targetId: string;
  priceLabel: string | null;
  disabled: boolean;
}) {
  const [checkoutVisible, setCheckoutVisible] = useState(false);

  useEffect(() => {
    if (disabled) return;
    const target = document.getElementById(targetId);
    if (!target) return;

    const observer = new IntersectionObserver(([entry]) => setCheckoutVisible(entry.isIntersecting));
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId, disabled]);

  if (disabled) return null;

  return (
    <Box
      hiddenFrom="md"
      pos="fixed"
      bottom={0}
      left={0}
      right={0}
      p="sm"
      style={{
        zIndex: 100,
        backgroundColor: "var(--mantine-color-body)",
        borderTop: "1px solid var(--mantine-color-default-border)",
        transform: checkoutVisible ? "translateY(100%)" : "translateY(0)",
        transition: "transform 200ms ease",
      }}
    >
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Text size="sm" fw={600} truncate>
          {priceLabel ? `Tickets from ${priceLabel}` : "Get tickets"}
        </Text>
        <Button onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" })}>
          Buy tickets
        </Button>
      </Group>
    </Box>
  );
}
