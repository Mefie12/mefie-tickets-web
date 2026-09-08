"use client";

import { Box, Button, Container, Group, Stack, Text } from "@mantine/core";
import { usePrivacyConsent } from "@/components/privacy/PrivacyConsentProvider";

/**
 * First-visit privacy banner (spec §5, §6). Non-modal fixed bar so it
 * never blocks discovery or checkout (spec §16). Mounted once, globally,
 * so it reaches every shell and unauthenticated/authenticated visitors
 * alike (spec §21.20).
 */
export function PrivacyConsentBanner() {
  const { showBanner, acceptAll, acceptNecessaryOnly, openPreferences } = usePrivacyConsent();

  if (!showBanner) return null;

  return (
    <Box
      role="region"
      aria-label="Your privacy choices"
      pos="fixed"
      bottom={0}
      left={0}
      right={0}
      p="md"
      style={{
        zIndex: 200,
        backgroundColor: "var(--mantine-color-body)",
        borderTop: "1px solid var(--mantine-color-default-border)",
        boxShadow: "0 -4px 16px rgba(0, 0, 0, 0.08)",
      }}
    >
      <Container size="xl" px={0}>
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <Stack gap={4} style={{ flex: "1 1 320px", minWidth: 0 }}>
            <Text fw={700}>Your privacy choices</Text>
            <Text size="sm" c="dimmed">
              We use essential cookies to keep Mefie working. With your permission, we&rsquo;d also
              like to improve Mefie by understanding how it&rsquo;s used. We don&rsquo;t use
              advertising cookies or track you across other sites.
            </Text>
          </Stack>
          <Group gap="sm" wrap="wrap">
            <Button variant="subtle" onClick={openPreferences}>
              See details
            </Button>
            <Button variant="default" onClick={acceptNecessaryOnly}>
              Only what&rsquo;s necessary
            </Button>
            <Button variant="default" onClick={acceptAll}>
              Accept all
            </Button>
          </Group>
        </Group>
      </Container>
    </Box>
  );
}
