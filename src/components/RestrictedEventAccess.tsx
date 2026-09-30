import Link from "next/link";
import { Button, Container, Stack, Text, Title } from "@mantine/core";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";
import { PublicSiteFooter } from "@/components/PublicSiteFooter";
import { VerifyInviteFlow } from "@/components/VerifyInviteFlow";

/**
 * `inviteMaskedEmail` comes from the short-lived `mefie_invite_preview`
 * cookie a personalized `/invite/{token}` link leaves behind (read
 * server-side by the page and passed down) — when present, the visitor
 * arrived via that link, so this skips straight to the inline
 * "verify it's you" step instead of sending them to the generic /login
 * page where they'd have to type their email.
 */
export function RestrictedEventAccess({ next, inviteMaskedEmail }: { next: string; inviteMaskedEmail?: string | null }) {
  return <>
    <PublicSiteHeader />
    <Container size="sm" py={100}>
      <Stack align="center" gap="md" ta="center">
        <Title order={1}>Invitation required</Title>
        {inviteMaskedEmail ? (
          <>
            <Text c="dimmed">Verify it&apos;s you to view this event.</Text>
            <Container size="xs" w="100%" p={0}>
              <VerifyInviteFlow maskedEmail={inviteMaskedEmail} />
            </Container>
          </>
        ) : (
          <>
            <Text c="dimmed">Sign in with the email address that received the invitation to view this event.</Text>
            <Button component={Link} href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Button>
          </>
        )}
      </Stack>
    </Container>
    <PublicSiteFooter />
  </>;
}
