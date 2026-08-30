import { NextRequest } from "next/server";
import { handleTokenEntry } from "@/lib/tokenEntry";

/**
 * GET /accept/{token} — personal-acceptance entry (docs/17 §11, §18).
 * Exchanges the raw token for `mefie_accept_flow`, stashes the preview
 * in `mefie_accept_preview`, and 302s to /accept/continue. Records
 * nothing — the confirm POST does that.
 */
export function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return params.then(({ token }) =>
    handleTokenEntry(request, {
      backendPath: `/api/public/accept/${encodeURIComponent(token)}`,
      previewCookie: { name: "mefie_accept_preview", minutes: 30 },
      resolveDestination: (status) =>
        status === "ready" ? "/accept/continue" : `/accept/continue?state=${encodeURIComponent(status)}`,
    }),
  );
}
