import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
  // Next's dev server treats 127.0.0.1 and localhost as different origins
  // and blocks /_next/static + HMR requests from an origin it doesn't
  // recognize — allow both so local browsing works either way.
  allowedDevOrigins: ["localhost", "127.0.0.1"],
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
