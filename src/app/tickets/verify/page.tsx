import { AuthLayout } from "@/components/AuthLayout";
import { VerifyLocatorFlow } from "@/components/VerifyLocatorFlow";

/**
 * /tickets/verify — token-free landing after the /t/{token} entry
 * handler. The raw locator token is already exchanged for the
 * `mefie_locator_flow` cookie; this screen only does the OTP.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;

  return (
    <AuthLayout title="Find your tickets" subtitle="Verify it's you to open your order.">
      <VerifyLocatorFlow entryState={state} />
    </AuthLayout>
  );
}
