/**
 * Pages whose URL carries a secret (an exchange, invitation or password-reset token). next.config.ts serves
 * them with no-store, no-referrer and noindex headers, so the token is never cached, leaked through a Referer
 * header to a third party, or indexed. Add any new token-in-the-URL page here.
 */
export const TOKEN_ROUTE_SOURCES = [
  "/t/:path*",
  "/claim/:path*",
  "/accept/:path*",
  "/reset-password",
  "/invitations/accept",
  "/admin/invitations/accept",
  "/distributor/invitations/:path*",
  "/venue/invitations/:path*",
] as const;
