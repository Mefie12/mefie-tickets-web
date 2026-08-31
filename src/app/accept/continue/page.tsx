import { Text } from "@mantine/core";
import { AuthLayout } from "@/components/AuthLayout";
import { AcceptForm } from "@/components/AcceptForm";
import type { AcceptPreview } from "@/lib/acceptApi";
import { readPreviewCookie } from "@/lib/tokenEntry";

export const dynamic = "force-dynamic";

const STATE_COPY: Record<string, string> = {
  expired: "This confirmation link has expired.",
  already: "You've already confirmed this ticket — you're all set.",
  superseded: "This ticket was reassigned, so this link no longer applies.",
  invalidated: "This ticket is no longer active.",
  notfound: "We couldn't find that confirmation link. Check the link and try again.",
};

/**
 * Token-free landing after /accept/{token}. The raw token is already
 * exchanged for mefie_accept_flow; the preview rides mefie_accept_preview.
 */
export default async function AcceptContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const preview = await readPreviewCookie<AcceptPreview>("mefie_accept_preview");

  if (state || !preview) {
    return (
      <AuthLayout title="Confirm your ticket">
        <Text size="sm" c="dimmed">
          {STATE_COPY[state ?? "notfound"] ?? STATE_COPY.notfound}
        </Text>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Confirm your ticket">
      <AcceptForm preview={preview} />
    </AuthLayout>
  );
}
