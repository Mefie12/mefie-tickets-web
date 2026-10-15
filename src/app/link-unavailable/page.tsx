import type { Metadata } from "next";
import { Button, Container, Group, Stack, Text, Title } from "@mantine/core";
import { IconPlugConnectedX } from "@tabler/icons-react";
import { MefieLogo } from "@/components/MefieLogo";
import { isPlausibleShortCode } from "@/lib/shortLink";

export const metadata: Metadata = { title: "Link temporarily unavailable", robots: { index: false, follow: false } };

/**
 * Where /s/{code} sends visitors when the lookup itself failed (API timeout
 * or error), as opposed to a link that doesn't exist (that goes to
 * /discover). Offers a retry of the same short link — the code is only echoed
 * back if it is a plausible short code, so this can't be turned into a link
 * to anywhere else.
 */
export default async function LinkUnavailablePage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const { code } = await searchParams;
  const retryCode = isPlausibleShortCode(code) ? code : null;

  return (
    <Container size="xs" py={100}>
      <Stack gap="xl" align="center">
        <MefieLogo h={22} />
        <IconPlugConnectedX size={64} stroke={1.5} opacity={0.6} />
        <Stack gap={4} align="center">
          <Title order={1} fz={28} ta="center">This link can&apos;t be opened right now</Title>
          <Text c="dimmed" size="sm" ta="center" maw={380}>Something went wrong on our side, so we couldn&apos;t find where this link goes. The link itself is probably fine — please try again in a moment.</Text>
        </Stack>
        <Group>
          {retryCode && <Button component="a" href={`/s/${retryCode}`} size="md">Try again</Button>}
          <Button component="a" href="/discover" size="md" variant="default">Browse events</Button>
        </Group>
      </Stack>
    </Container>
  );
}
