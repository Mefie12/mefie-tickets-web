"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { logout } from "@/lib/authApi";
import { portalLogout, portalLogoutAll } from "@/lib/portalApi";
import { performSignOut } from "@/lib/signOut";
import { allowUnload, confirmLeave } from "@/lib/leaveGuard";
import { unsavedRegistry } from "@/lib/unsavedChangesRegistry";

export type SignOutKind = "organizer" | "consumer" | "consumer-all";

const logoutFor = { organizer: logout, consumer: portalLogout, "consumer-all": portalLogoutAll } as const;

/** Does the server still see a session? Only a clear 401 means no; anything else is "unknown", treated as still signed in. */
async function stillSignedIn(kind: SignOutKind): Promise<boolean> {
  const res = await fetch(kind === "organizer" ? "/api/users/me" : "/api/portal/consumer/state", { cache: "no-store" });
  return res.status !== 401;
}

/**
 * The one way every shell signs out. After a confirmed sign-out it does a full-document navigation to
 * `redirectTo` (which drops all in-memory state, so the query cache is not cleared separately: clearing it
 * first would let live queries refetch, 401, and race the redirect with an "expired" banner). With no
 * `redirectTo` (the public site nav) it clears the cache and calls `onDone` instead.
 *
 * It never claims a sign-out it can't confirm: see performSignOut. On failure the user gets an error
 * with a Retry action.
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const signOut = useCallback(
    async function run(kind: SignOutKind, options: { redirectTo: string | null; onDone?: () => void }): Promise<void> {
      // Ask before ending the session: once logged out, unsaved edits can't be saved anyway.
      if (unsavedRegistry.getSnapshot().dirtyIds.length > 0 && !(await confirmLeave())) return;
      setPending(true);
      const outcome = await performSignOut({
        logout: logoutFor[kind],
        stillSignedIn: () => stillSignedIn(kind),
        clearClientState: () => {
          if (options.redirectTo === null) queryClient.clear();
        },
      });
      setPending(false);

      if (outcome === "signed-out") {
        if (options.redirectTo !== null) {
          allowUnload(); // already confirmed above; don't let the browser ask again
          window.location.replace(options.redirectTo);
        }
        else options.onDone?.();
        return;
      }
      notifications.show({
        color: "red",
        autoClose: 10000,
        message: (
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Text size="sm">Couldn&apos;t confirm you were signed out. You&apos;re still signed in.</Text>
            <Button size="compact-xs" variant="light" onClick={() => void run(kind, options)}>Try again</Button>
          </Group>
        ),
      });
    },
    [queryClient],
  );

  return { signOut, pending };
}
