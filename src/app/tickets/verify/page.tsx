import { Alert, Stack } from "@mantine/core";
import { AuthLayout } from "@/components/AuthLayout";
import { VerifyLocatorFlow } from "@/components/VerifyLocatorFlow";

/**
 * /tickets/verify — token-free landing after the /t/{token} entry
 * handler. The raw locator token is already exchanged for the
 * `mefie_locator_flow` cookie; this screen only does the OTP.
 *
 * Also the screen a lapsed portal session lands on (`?expired=1`) — the
 * consumer has no password, so re-entry is the emailed order link.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; expired?: string }>;
}) {
  const { state, expired } = await searchParams;
  const sessionExpired = expired === "1";

  return (
    <AuthLayout
      title="Find your tickets"
      subtitle={sessionExpired ? undefined : "Verify it's you to open your order."}
    >
      <Stack>
        {sessionExpired && (
          <Alert color="orange" title="Your session expired">
            You were signed out after a period of inactivity. Enter a fresh code, or open the link
            from your order email again to sign back in.
          </Alert>
        )}
        <VerifyLocatorFlow entryState={state} />
      </Stack>
    </AuthLayout>
  );
}
