import { NextRequest } from "next/server";
import { handleTokenEntry } from "@/lib/tokenEntry";

/**
 * GET /invite/{token} — personalized event-invitation entry. Exchanges
 * the raw invite token for the `mefie_invite_flow` cookie and 303s
 * straight to the event page itself (never a token-free landing page of
 * its own, since the destination differs per invitation). The masked
 * email is stashed in a short-lived preview cookie so the event page can
 * render the inline "verify it's you" step without a query string.
 */
export function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return params.then(({ token }) =>
    handleTokenEntry(request, {
      backendPath: `/api/public/event-invitations/${encodeURIComponent(token)}`,
      previewCookie: { name: "mefie_invite_preview", minutes: 10 },
      resolveDestination: (status, _httpStatus, data) => {
        const eventPath = typeof data.event_path === "string" ? data.event_path : null;
        if (status === "verification_required" && eventPath) {
          return eventPath;
        }

        // An invalid/removed token, or an invitation whose event/series
        // no longer resolves to a path — nowhere sensible to send them
        // back to, so land on discover rather than a dead link.
        return "/discover";
      },
    }),
  );
}
