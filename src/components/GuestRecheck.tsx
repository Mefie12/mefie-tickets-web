"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { consumerDestination, organizerGuestRedirect } from "@/lib/postAuthDestination";

/**
 * The server guard cannot see Back: Next reuses a cached page for browser back/forward, and the
 * browser's own back/forward cache can restore one without any request. So a guest-only page that
 * was rendered a while ago (or is restored from bfcache) asks once whether the visitor has since
 * signed in, and replaces itself if so.
 *
 * A page the server rendered moments ago was just checked by the guard, so it skips the request;
 * an anonymous visitor on a fresh load costs no extra call.
 */
const FRESH_MS = 3000;

export function GuestRecheck({ kind, renderedAt }: { kind: "organizer" | "consumer"; renderedAt: number }) {
  const router = useRouter();
  const next = useSearchParams().get("next");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch(kind === "organizer" ? "/api/users/me" : "/api/portal/consumer/state", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        if (kind === "organizer") {
          const data = (await res.json()) as { user?: { email_verified_at: string | null; current_organization_id: string | null } };
          if (data.user) router.replace(organizerGuestRedirect(data.user, next));
        } else {
          router.replace(consumerDestination(next));
        }
      } catch {
        // Offline or the API is down: leave the form usable.
      }
    }

    if (Math.abs(Date.now() - renderedAt) > FRESH_MS) void check();
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void check();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [kind, next, renderedAt, router]);

  return null;
}
