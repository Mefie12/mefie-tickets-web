"use client";

import Link from "next/link";
import { useState } from "react";
import { Box, Button, Container, Grid, Group, Stack, Text, Title } from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
import { IconArrowRight, IconSearch } from "@tabler/icons-react";
import { PublicSearchPanel } from "@/components/PublicSearchPanel";

const HERO_VIDEO_URL =
  "https://mefie-tickets-staging-media.s3.eu-north-1.amazonaws.com/platform-files/videos/dice-sampled.mp4";

export function HomeHero() {
  const [searchOpened, setSearchOpened] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <>
      <Container size="xl" py={{ base: 48, md: 72 }}>
        <Grid gutter={{ base: 40, md: 64 }} align="center">
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Stack gap="xl" maw={720}>
              <Text tt="uppercase" fw={800} c="brand.5" lts={2}>
                Live experiences, made simple
              </Text>
              <Title order={1} fz="clamp(3rem, 7vw, 6rem)" lh={0.92} fw={900}>
                Find something worth showing up for.
              </Title>
              <Text size="xl" c="dimmed" maw={650}>
                Discover concerts, parties, talks, festivals and unforgettable moments from organizers across Ghana and beyond.
              </Text>
              <Group>
                <Button size="xl" leftSection={<IconSearch size={20} />} onClick={() => setSearchOpened(true)}>
                  Search events
                </Button>
                <Button component={Link} href="/discover" size="xl" variant="subtle" rightSection={<IconArrowRight size={20} />}>
                  Discover events
                </Button>
              </Group>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 5 }}>
            <Box maw={480} mx={{ base: "auto", md: 0 }} ml={{ md: "auto" }}>
              <video
                src={HERO_VIDEO_URL}
                autoPlay={!reduceMotion}
                muted
                loop
                playsInline
                preload="metadata"
                controls={false}
                disablePictureInPicture
                disableRemotePlayback
                aria-hidden="true"
                style={{
                  display: "block",
                  width: "100%",
                  aspectRatio: "4 / 5",
                  objectFit: "cover",
                  borderRadius: 4,
                  backgroundColor: "var(--mantine-color-gray-light)",
                }}
              />
            </Box>
          </Grid.Col>
        </Grid>
      </Container>

      <PublicSearchPanel opened={searchOpened} onClose={() => setSearchOpened(false)} />
    </>
  );
}
