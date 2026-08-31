import { NextRequest } from "next/server";
import { handleTokenEntry } from "@/lib/tokenEntry";

/**
 * GET /claim/{token} — guest claim-link entry (docs/17 §8.5, §18).
 * Exchanges the raw token for `mefie_claim_flow`, stashes the
 * privacy-minimised preview in `mefie_claim_preview`, and 302s to
 * /claim/continue. Non-claimable states carry ?state so the continue
 * page can explain why.
 */
export function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return params.then(({ token }) =>
    handleTokenEntry(request, {
      backendPath: `/api/public/claim/${encodeURIComponent(token)}`,
      previewCookie: { name: "mefie_claim_preview", minutes: 30 },
      resolveDestination: (status) =>
        status === "claimable" ? "/claim/continue" : `/claim/continue?state=${encodeURIComponent(status)}`,
    }),
  );
}
