import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Next's dev server treats 127.0.0.1 and localhost as different origins
  // and blocks /_next/static + HMR requests from an origin it doesn't
  // recognize — allow both so local browsing works either way.
  allowedDevOrigins: ["localhost", "127.0.0.1"],
};

export default nextConfig;
