"use client";

import { Box, Group, Stack, Text, Title, TypographyStylesProvider } from "@mantine/core";

/** Readable rendering of a sanitised legal document: title, version/date line, real typography, a comfortable line length. */
export function LegalDocumentView({
  title,
  versionNumber,
  publishedAt,
  html,
  hideTitle = false,
}: {
  title: string;
  versionNumber?: number | null;
  publishedAt?: string | null;
  html: string;
  /** The surrounding modal/page already shows the title. */
  hideTitle?: boolean;
}) {
  const updated = publishedAt ? new Date(publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
  const meta = [versionNumber ? `Version ${versionNumber}` : null, updated ? `Last updated ${updated}` : null].filter(Boolean).join(" · ");

  return (
    <Stack gap="md">
      {!hideTitle && <Title order={1} size="h2">{title}</Title>}
      {meta && (
        <Group gap="xs">
          <Text size="sm" c="dimmed">{meta}</Text>
        </Group>
      )}
      <TypographyStylesProvider>
        <Box maw="70ch" style={{ overflowWrap: "anywhere" }} dangerouslySetInnerHTML={{ __html: html }} />
      </TypographyStylesProvider>
    </Stack>
  );
}
