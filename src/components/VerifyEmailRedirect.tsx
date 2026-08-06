"use client";

import { useRouter } from "next/navigation";
import { VerifyEmailPanel } from "@/components/VerifyEmailPanel";

/** Thin client wrapper so /verify-email/page.tsx can stay a server component. */
export function VerifyEmailRedirect({ expiresAt }: { expiresAt: string | null }) {
  const router = useRouter();

  return <VerifyEmailPanel onVerified={() => router.push("/settings")} expiresAt={expiresAt} />;
}
