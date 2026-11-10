import { Stack, Text, Title } from "@mantine/core";
import { OrganizationLegalPanel } from "@/components/OrganizationLegalPanel";

export default function OrganizationLegalPage() {
  return (
    <Stack gap="md" maw={720}>
      <Title order={2}>Legal</Title>
      <Text c="dimmed">The platform documents that apply to your organization, and any changes we&apos;ve told you about. Anyone can read them at any time on the public Legal pages.</Text>
      <OrganizationLegalPanel />
    </Stack>
  );
}
