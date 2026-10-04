import { describe, expect, it } from "vitest";
import { TOKEN_ROUTE_SOURCES } from "./tokenRoutes";

describe("TOKEN_ROUTE_SOURCES", () => {
  it("covers every page that carries a token in its URL", () => {
    for (const path of [
      "/t/:path*",
      "/claim/:path*",
      "/accept/:path*",
      "/reset-password",
      "/invitations/accept",
      "/admin/invitations/accept",
      "/distributor/invitations/:path*",
    ]) {
      expect(TOKEN_ROUTE_SOURCES).toContain(path);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(TOKEN_ROUTE_SOURCES).size).toBe(TOKEN_ROUTE_SOURCES.length);
  });
});
