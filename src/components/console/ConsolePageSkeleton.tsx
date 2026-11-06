import { Card, Group, SimpleGrid, Skeleton, Stack } from "@mantine/core";

/**
 * Instant placeholder shown while a console page's server data loads (used by the route
 * `loading.tsx` files). Mirrors the real pages' frame — a Stack with a max width, a 28px title and
 * bordered Cards — so the swap to real content doesn't jump. Pure server-renderable markup.
 *
 *  - `table`: heading + action button + a bordered table (Team, Orders, Attendees…)
 *  - `list`:  heading + stacked bordered rows (Events, Series…)
 *  - `form`:  heading + a form card (Organization, Settings…)
 *  - `cards`: heading + a grid of summary cards (Dashboard, Payments…)
 */
export type ConsoleSkeletonVariant = "table" | "list" | "form" | "cards";

const MAX_WIDTH: Record<ConsoleSkeletonVariant, number> = { table: 880, list: 720, form: 640, cards: 720 };

function Heading({ withAction }: { withAction?: boolean }) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Skeleton height={32} width={180} radius="sm" />
      {withAction && <Skeleton height={36} width={140} radius="md" />}
    </Group>
  );
}

function Rows({ count, height = 44 }: { count: number; height?: number }) {
  return (
    <Stack gap={0}>
      {Array.from({ length: count }, (_, i) => (
        <Group key={i} gap="md" p="md" wrap="nowrap" style={{ borderTop: i === 0 ? undefined : "1px solid var(--mantine-color-default-border)" }}>
          <Skeleton height={height * 0.4} circle />
          <Skeleton height={14} width="28%" radius="sm" />
          <Skeleton height={14} width="34%" radius="sm" />
          <Skeleton height={14} width="14%" radius="sm" ml="auto" />
        </Group>
      ))}
    </Stack>
  );
}

export function ConsolePageSkeleton({ variant = "list" }: { variant?: ConsoleSkeletonVariant }) {
  return (
    <Stack gap="xl" maw={MAX_WIDTH[variant]} role="status" aria-busy="true" aria-label="Loading">
      <Heading withAction={variant === "table" || variant === "list"} />

      {variant === "table" && (
        <Card withBorder radius="lg" p={0}>
          <Group p="md" gap="xl" wrap="nowrap" style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
            {[80, 100, 70, 60, 70].map((w, i) => (
              <Skeleton key={i} height={12} width={w} radius="sm" />
            ))}
          </Group>
          <Rows count={6} />
        </Card>
      )}

      {variant === "list" && (
        <Stack gap="md">
          {[0, 1, 2].map((i) => (
            <Card key={i} withBorder radius="lg" p="lg">
              <Stack gap="sm">
                <Skeleton height={20} width="45%" radius="sm" />
                <Skeleton height={14} width="30%" radius="sm" />
                <Skeleton height={14} width="60%" radius="sm" />
              </Stack>
            </Card>
          ))}
        </Stack>
      )}

      {variant === "form" && (
        <Card withBorder radius="lg" p="xl">
          <Stack gap="lg">
            {[0, 1, 2, 3].map((i) => (
              <Stack key={i} gap={6}>
                <Skeleton height={12} width={110} radius="sm" />
                <Skeleton height={36} radius="md" />
              </Stack>
            ))}
            <Skeleton height={36} width={120} radius="md" />
          </Stack>
        </Card>
      )}

      {variant === "cards" && (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} withBorder radius="lg" p="lg">
                <Stack gap="sm">
                  <Skeleton height={12} width="40%" radius="sm" />
                  <Skeleton height={28} width="55%" radius="sm" />
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
          <Card withBorder radius="lg" p={0}>
            <Rows count={3} />
          </Card>
        </>
      )}
    </Stack>
  );
}
