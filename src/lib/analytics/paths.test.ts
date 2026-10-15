import { describe, expect, it } from "vitest";
import { analyticsLocation, isTrackablePath } from "./paths";
import { TOKEN_ROUTE_SOURCES } from "@/lib/tokenRoutes";

describe("isTrackablePath", () => {
  it("allows the public site", () => {
    for (const path of ["/", "/discover", "/acme", "/acme/summer-fest", "/acme/summer-fest/checkout", "/acme/weekly-jam/occ_123", "/support", "/legal"]) {
      expect(isTrackablePath(path), path).toBe(true);
    }
  });

  it("blocks logged-in areas, auth pages and the api", () => {
    for (const path of ["/dashboard", "/events/12", "/event-series/3/settings", "/organization", "/settings", "/onboarding", "/admin/orders", "/gate/ops", "/venue", "/distributor", "/tickets", "/login", "/organizers/login", "/register", "/forgot-password", "/verify-email", "/api/events"]) {
      expect(isTrackablePath(path), path).toBe(false);
    }
  });

  it("blocks every token-in-the-URL page, however it is written", () => {
    for (const path of ["/t/abc123", "/claim/xyz", "/accept/tok", "/reset-password", "/invitations/accept", "/admin/invitations/accept", "/distributor/invitations/tok", "/venue/invitations/tok", "/T/ABC", "/claim/xyz/", "/s/abc123"]) {
      expect(isTrackablePath(path), path).toBe(false);
    }
  });

  it("covers every TOKEN_ROUTE_SOURCES entry", () => {
    for (const source of TOKEN_ROUTE_SOURCES) {
      expect(isTrackablePath(source.replace(":path*", "some-token")), source).toBe(false);
    }
  });

  it("ignores query strings and fragments when deciding", () => {
    expect(isTrackablePath("/acme/fest?utm_source=x")).toBe(true);
    expect(isTrackablePath("/dashboard?next=/acme")).toBe(false);
    expect(isTrackablePath("/t#/acme")).toBe(false);
  });
});

describe("analyticsLocation", () => {
  it("keeps only campaign tags and click ids", () => {
    expect(analyticsLocation("https://mefie-tickets.com/acme/fest?utm_source=whatsapp&utm_medium=social&order=ABC123&token=secret&fbclid=f1"))
      .toBe("https://mefie-tickets.com/acme/fest?utm_source=whatsapp&utm_medium=social&fbclid=f1");
  });

  it("drops the whole query when nothing is allowlisted and the fragment always", () => {
    expect(analyticsLocation("https://mefie-tickets.com/acme/fest?order=ABC123#section")).toBe("https://mefie-tickets.com/acme/fest");
  });
});
