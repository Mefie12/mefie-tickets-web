import { Suspense } from "react";
import { GuestRecheck } from "@/components/GuestRecheck";
import { redirectIfSignedIn, renderedAtMs } from "@/lib/guestGuard";

/**
 * Guest-only: a visitor who is already signed in never sees this page (see lib/guestGuard.ts).
 * GuestRecheck covers a cached copy restored by the Back button, which the server never sees.
 */
export default async function GuestOnlyLayout({ children }: { children: React.ReactNode }) {
  await redirectIfSignedIn("consumer");
  const renderedAt = renderedAtMs();
  return (
    <>
      <Suspense>
        <GuestRecheck kind="consumer" renderedAt={renderedAt} />
      </Suspense>
      {children}
    </>
  );
}
