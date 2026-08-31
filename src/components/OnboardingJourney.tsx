"use client";

import { Box, Group, Stack, Text } from "@mantine/core";
import { IconCalendarPlus, IconCash, IconChartBar, IconCreditCard, IconRocket } from "@tabler/icons-react";

export const ONBOARDING_JOURNEY_STEPS = [
  { key: "financials", label: "Add your financial details", Icon: IconCreditCard },
  { key: "event", label: "Create your first event", Icon: IconCalendarPlus },
  { key: "publish", label: "Publish your event", Icon: IconRocket },
  { key: "track", label: "Track your sales", Icon: IconChartBar },
  { key: "paid", label: "Get paid", Icon: IconCash },
] as const;

type JourneyKey = (typeof ONBOARDING_JOURNEY_STEPS)[number]["key"];

/**
 * The "here's what happens now" strip shown on every step of the
 * post-registration onboarding wizard (onboarding/page.tsx). Purely
 * informational — not clickable, and it tracks no completion state
 * (there is no server-side onboarding progress). `activeKey` emphasises
 * the step the wizard is currently on; pass nothing on the welcome
 * screen. "Publish your event" — not "submit for review": this product
 * has no event review stage, events go DRAFT -> LIVE directly.
 */
export function OnboardingJourney({ activeKey }: { activeKey?: JourneyKey }) {
  return (
    <Group gap={0} wrap="nowrap" align="flex-start" style={{ overflowX: "auto" }}>
      {ONBOARDING_JOURNEY_STEPS.map((step, index) => {
        const active = step.key === activeKey;
        return (
          <Group
            key={step.key}
            gap={0}
            wrap="nowrap"
            align="flex-start"
            style={{ flex: index === 0 ? "0 0 auto" : 1 }}
          >
            {index > 0 && (
              <Box
                style={{
                  flex: 1,
                  minWidth: 20,
                  height: 1,
                  marginTop: 22,
                  background: "var(--mantine-color-default-border)",
                }}
              />
            )}
            <Stack gap={6} align="center" style={{ flex: "0 0 auto", width: 104 }}>
              <Box
                style={{
                  width: 44,
                  height: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "var(--mantine-radius-md)",
                  border: `1px solid ${
                    active ? "var(--mantine-color-brand-filled)" : "var(--mantine-color-default-border)"
                  }`,
                  background: active ? "var(--mantine-color-brand-light)" : "transparent",
                  color: active ? "var(--mantine-color-brand-filled)" : "var(--mantine-color-text)",
                }}
              >
                <step.Icon size={22} />
              </Box>
              <Text size="xs" ta="center" lh={1.3} fw={active ? 600 : 400} c={active ? undefined : "dimmed"}>
                {step.label}
              </Text>
            </Stack>
          </Group>
        );
      })}
    </Group>
  );
}
