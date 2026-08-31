import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Token-exchange landing paths (docs/17 §18): no caching/storage, no
// referrer leak of the raw {token} segment, never indexed. Defence in
// depth alongside the backend `token.route` middleware and the
// per-handler headers in src/lib/tokenEntry.ts.
const TOKEN_ROUTE_HEADERS = [
  { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  /* config options here */
  // Next's dev server treats 127.0.0.1 and localhost as different origins
  // and blocks /_next/static + HMR requests from an origin it doesn't
  // recognize — allow both so local browsing works either way.
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  async headers() {
    return [
      { source: "/t/:path*", headers: TOKEN_ROUTE_HEADERS },
      { source: "/claim/:path*", headers: TOKEN_ROUTE_HEADERS },
      { source: "/accept/:path*", headers: TOKEN_ROUTE_HEADERS },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // No auth token set outside CI — source map upload to Sentry is
  // skipped locally and only runs where SENTRY_AUTH_TOKEN is provided.
  webpack: {
    treeshake: { removeDebugLogging: true },
  },
});
