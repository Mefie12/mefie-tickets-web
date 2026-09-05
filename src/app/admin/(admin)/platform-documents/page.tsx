"use client";

import { Divider, Stack, Text, Title } from "@mantine/core";
import { PlatformDocumentEditor } from "@/components/PlatformDocumentEditor";

export default function PlatformDocumentsPage() {
  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={2}>Legal Documents</Title>
        <Text c="dimmed">
          The Terms of Use and Privacy Policy shown to every organizer creating an account. Editing here never
          changes what&apos;s already published — publishing always creates a new version.
        </Text>
      </Stack>

      <PlatformDocumentEditor type="terms-of-use" title="Terms of Use" disabled={false} />

      <Divider />

      <PlatformDocumentEditor type="privacy-policy" title="Privacy Policy" disabled={false} />
    </Stack>
  );
}
