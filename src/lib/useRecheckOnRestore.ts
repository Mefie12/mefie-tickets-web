"use client";

import { useEffect } from "react";
import { ApiError } from "@/lib/authApi";
import { handleSessionExpiry } from "@/lib/sessionExpiry";

/**
 * Protected pages: if the browser restores one from its back/forward cache after the session ended
 * (signed out in another tab, or just now), the page comes back looking signed in without any request.
 * On such a restore, ask the server once; a 401 sends the visitor to the right sign-in screen.
 * Server-side invalidation is what actually protects the data; this only stops a stale screen.
 */
export function useRecheckOnRestore(kind: "organizer" | "consumer") {
  useEffect(() => {
    const onPageShow = async (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      try {
        const res = await fetch(kind === "organizer" ? "/api/users/me" : "/api/portal/consumer/state", { cache: "no-store" });
        if (res.status === 401) handleSessionExpiry(new ApiError("Signed out", 401));
      } catch {
        // Offline: nothing to conclude.
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [kind]);
}
