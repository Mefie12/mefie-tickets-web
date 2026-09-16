import { Box, Group, Image, Stack, Text, Title } from "@mantine/core";
import classes from "./discoverHero.module.css";

/** Static copy for v1 — the split copy/photo composition mirrors the default social card at every viewport. */
export function DiscoverHero() {
  return (
    <Box className={classes.hero} py={{ base: 0, md: 40 }} px={{ base: 0, md: 64 }}>
      <Group className={classes.content} justify="center" align="stretch" gap={0} wrap="nowrap" maw={1312} mx="auto">
        <Stack className={classes.copy} gap={12}>
          <Text className={classes.eyebrow} size="sm" c="lime.5" fw={500} tt="uppercase">
            Events worth showing up for
          </Text>
          <Title order={1} c="white" fz={{ base: 20, md: 56 }} lh={{ base: 1.2, md: 1.25 }} maw={620}>
            Find your next unforgettable moment.
          </Title>
          <Text c="#d8d1e8" fz={{ base: 12, md: 18 }} maw={580}>
            Discover music, culture, food, ideas and people shaping your city.
          </Text>
        </Stack>
        <Box className={classes.photo}>
          <Image src="/images/discover-hero.jpg" alt="A singer performing into a microphone" h="100%" fit="cover" style={{ objectPosition: "35% center" }} />
        </Box>
      </Group>
    </Box>
  );
}
