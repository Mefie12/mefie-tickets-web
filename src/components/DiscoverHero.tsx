import { Box, Group, Image, Stack, Text, Title } from "@mantine/core";

/**
 * Static copy for v1 — not admin-configurable. The spotlight photo is
 * hidden below `md` per the Figma mobile frame (no room, and the hero
 * gets much shorter on small screens).
 */
export function DiscoverHero() {
  return (
    <Box bg="navy.9" py={{ base: 20, md: 40 }} px={{ base: 16, md: 64 }}>
      <Group justify="center" align="center" gap={48} wrap="nowrap" maw={1312} mx="auto">
        <Stack gap={12} style={{ flex: 1 }}>
          <Text size="sm" c="lime.5" fw={500} tt="uppercase">
            Events worth showing up for
          </Text>
          <Title order={1} c="white" fz={{ base: 24, md: 56 }} lh={{ base: 1.25, md: 1.25 }} maw={620}>
            Find your next unforgettable moment.
          </Title>
          <Text c="#d8d1e8" fz={{ base: 14, md: 18 }} maw={580}>
            Discover music, culture, food, ideas and people shaping your city.
          </Text>
        </Stack>
        <Box visibleFrom="md" style={{ flexShrink: 0, width: 430, height: 260, borderRadius: 24, overflow: "hidden" }}>
          <Image src="/images/discover-hero.png" alt="" h="100%" fit="cover" />
        </Box>
      </Group>
    </Box>
  );
}
