import { Badge, Card, Divider, Group, Stack, Text, Title } from "@mantine/core";
import type { OrganizerPayoutSummary } from "@/lib/organizerPayoutApi";
import { formatAmount } from "@/lib/money";

/**
 * Read-only — no Stripe Connect, so there's nothing to "withdraw" here.
 * Funds sit in the platform's Stripe account; a SUPERADMIN records a
 * manual release (bank transfer etc.) outside this app, and this card
 * just shows the resulting balance/history. See
 * docs/09_mvp_development_plan.md Milestone 6.
 */
export function OrganizationPayoutCard({ summary }: { summary: OrganizerPayoutSummary }) {
  return (
    <Card withBorder radius="lg" p="xl">
      <Stack gap="md">
        <Title order={3} fz={20}>
          Payouts
        </Title>

        <Group grow>
          <Stack gap={0}>
            <Text size="xs" c="dimmed">
              Collected
            </Text>
            <Text fw={600}>{formatAmount(summary.collected, summary.currency)}</Text>
          </Stack>
          <Stack gap={0}>
            <Text size="xs" c="dimmed">
              Released
            </Text>
            <Text fw={600}>{formatAmount(summary.released, summary.currency)}</Text>
          </Stack>
          <Stack gap={0}>
            <Text size="xs" c="dimmed">
              Balance
            </Text>
            <Text fw={600} c="brand">
              {formatAmount(summary.balance, summary.currency)}
            </Text>
          </Stack>
        </Group>

        <Text size="xs" c="dimmed">
          Funds are held by the platform and released manually — this is a temporary setup while a payment-gateway
          decision is finalized.
        </Text>

        {summary.history.length > 0 && (
          <>
            <Divider label="Release history" labelPosition="left" />
            <Stack gap="xs">
              {summary.history.map((release) => (
                <Group key={release.id} justify="space-between" align="flex-start">
                  <Stack gap={0}>
                    <Text size="sm">{formatAmount(release.amount, summary.currency)}</Text>
                    {release.note && (
                      <Text size="xs" c="dimmed">
                        {release.note}
                      </Text>
                    )}
                  </Stack>
                  <Stack gap={0} align="flex-end">
                    <Badge variant="light" size="sm">
                      {new Date(release.created_at).toLocaleDateString()}
                    </Badge>
                    <Text size="xs" c="dimmed">
                      by {release.released_by.first_name} {release.released_by.last_name}
                    </Text>
                  </Stack>
                </Group>
              ))}
            </Stack>
          </>
        )}
      </Stack>
    </Card>
  );
}
