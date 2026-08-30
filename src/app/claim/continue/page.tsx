import { Text } from "@mantine/core";
import { AuthLayout } from "@/components/AuthLayout";
import { ClaimForm } from "@/components/ClaimForm";
import type { ClaimPreview } from "@/lib/claimApi";
import { readPreviewCookie } from "@/lib/tokenEntry";

export const dynamic = "force-dynamic";

const STATE_COPY: Record<string, string> = {
  expired: "This invitation has expired.",
  revoked: "This invitation was withdrawn by the sender.",
  claimed: "This invitation has already been used.",
  already_assigned: "This ticket has already been assigned.",
  notfound: "We couldn't find that invitation. Check the link and try again.",
};

/**
 * Token-free landing after /claim/{token}. The raw token is already
 * exchanged for the mefie_claim_flow cookie; the preview payload rides
 * the short-lived mefie_claim_preview cookie.
 */
export default async function ClaimContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const preview = await readPreviewCookie<ClaimPreview>("mefie_claim_preview");

  if (state || !preview) {
    return (
      <AuthLayout title="Ticket invitation">
        <Text size="sm" c="dimmed">
          {STATE_COPY[state ?? "notfound"] ?? STATE_COPY.notfound}
        </Text>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Claim your ticket" subtitle="No account needed — just a few details.">
      <ClaimForm preview={preview} />
    </AuthLayout>
  );
}
