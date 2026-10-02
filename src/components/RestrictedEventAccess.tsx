import { Container, Stack, Text, Title } from "@mantine/core";
import { LinkButton } from "@/components/LinkButton";
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
        <Title order={1}>This is an invite-only event</Title>
        {inviteMaskedEmail ? (
          <>
            <Text c="dimmed">You were invited to this event. Verify it&apos;s you to view it.</Text>
            <Container size="xs" w="100%" p={0}>
              <VerifyInviteFlow maskedEmail={inviteMaskedEmail} />
            </Container>
          </>
        ) : (
          <>
            <Text c="dimmed">You&apos;re trying to view an invite-only event. Sign in with the email address that received the invitation to continue.</Text>
            <LinkButton href={`/login?next=${encodeURIComponent(next)}`}>Sign in</LinkButton>
          </>
        )}
      </Stack>
    </Container>
    <PublicSiteFooter />
  </>;
}
