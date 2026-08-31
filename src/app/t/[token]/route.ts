import { NextRequest } from "next/server";
import { handleTokenEntry } from "@/lib/tokenEntry";

/**
 * GET /t/{locatorToken} — order-locator entry (docs/17 §9.3, §18).
 * Exchanges the raw locator token for the `mefie_locator_flow` cookie
 * and 302s to a token-free URL. No preview cookie: /tickets/verify gets
 * the masked email from the OTP-request response instead.
 */
export function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return params.then(({ token }) =>
    handleTokenEntry(request, {
      backendPath: `/api/public/locator/${encodeURIComponent(token)}`,
      previewCookie: null,
      resolveDestination: (status) => {
        switch (status) {
          case "owned":
            return "/tickets";
          case "verification_required":
            return "/tickets/verify";
          case "mismatch":
            return "/tickets/verify?state=mismatch";
          case "expired":
            return "/tickets/verify?state=expired";
          default:
            return "/tickets/verify?state=notfound";
        }
      },
    }),
  );
}
