"use client";

import { useEffect, useRef } from "react";
import { Box, Button, Container, Group, Stack, Text } from "@mantine/core";
import classes from "./privacyConsentBanner.module.css";
import { usePrivacyConsent } from "@/components/privacy/PrivacyConsentProvider";
import { joinNames, marketingPlatformNames } from "@/lib/analytics/config";

/**
 * First-visit privacy banner (spec §5, §6). Non-modal fixed bar so it
 * never blocks discovery or checkout (spec §16). Mounted once, globally,
 * so it reaches every shell and unauthenticated/authenticated visitors
 * alike (spec §21.20).
 *
 * It never sits on top of page controls: it starts after a dashboard sidebar
 * (see the module CSS), reserves its own height at the end of the page via a
 * spacer, and publishes that height as `--privacy-banner-height` so other
 * bottom-pinned bars (save bar, mobile buy bar) lift above it.
 */
export function PrivacyConsentBanner() {
  const { showBanner, marketingOffered, acceptAll, acceptNecessaryOnly, openPreferences } = usePrivacyConsent();

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!showBanner || !element) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty("--privacy-banner-height", `${element.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--privacy-banner-height");
    };
  }, [showBanner]);

  if (!showBanner) return null;

  return (
    <>
    {/* In-flow space equal to the bar, so the last controls on a page can be scrolled above it. */}
    <div aria-hidden style={{ height: "var(--privacy-banner-height, 0px)" }} />
    <Box
      ref={ref}
      className={classes.banner}
      role="region"
      aria-label="Your privacy choices"
      pos="fixed"
      bottom={0}
      right={0}
      style={{
        // Mantine's own scale is app:100 < modal:200 (@mantine/core/styles.css).
        // Every Modal must stay above this ("never blocks discovery or checkout",
        // see docblock); an open mobile navigation drawer (also 100) may cover it.
        zIndex: 100,
        backgroundColor: "var(--mantine-color-body)",
        borderTop: "1px solid var(--mantine-color-default-border)",
        boxShadow: "0 -4px 16px rgba(0, 0, 0, 0.08)",
      }}
    >
      <Container size="xl" px={0}>
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <Stack gap={4} style={{ flex: "1 1 320px", minWidth: 0 }}>
            <Text fw={700} className={classes.title}>Your privacy choices</Text>
            <Text size="sm" c="dimmed" className={classes.text}>
              We use essential cookies to keep Mefie working. With your permission, we&rsquo;d also like
              to understand how Mefie is used, using analytics and a small sample of session
              recordings, so we can fix problems and improve it.{" "}
              {marketingOffered
                ? `With your separate permission, we'd also like to measure and improve our advertising on other platforms, such as ${joinNames(marketingPlatformNames())}.`
                : "We don\u2019t use advertising cookies."}
            </Text>
          </Stack>
          <Group gap="sm" wrap="wrap" className={classes.actions}>
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
    </>
  );
}
