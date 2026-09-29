import Link from "next/link";
import { Button, Container, Stack, Text, Title } from "@mantine/core";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";
import { PublicSiteFooter } from "@/components/PublicSiteFooter";

export function RestrictedEventAccess({ next }: { next: string }) {
  return <>
    <PublicSiteHeader />
    <Container size="sm" py={100}>
      <Stack align="center" gap="md" ta="center">
        <Title order={1}>Invitation required</Title>
        <Text c="dimmed">Sign in with the email address that received the invitation to view this event.</Text>
        <Button component={Link} href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Button>
      </Stack>
    </Container>
    <PublicSiteFooter />
  </>;
}
