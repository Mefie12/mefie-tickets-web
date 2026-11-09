import { describe, expect, it } from "vitest";
import {
  consumerDestination, nextFromReturnPath, organizerDestination, organizerGuestRedirect, organizerHome,
} from "@/lib/postAuthDestination";

const org = { email_verified_at: "2026-01-01T00:00:00Z", current_organization_id: "org-1" };
const distributor = { email_verified_at: "2026-01-01T00:00:00Z", current_organization_id: null };
const unverified = { email_verified_at: null, current_organization_id: "org-1" };

describe("organizer destination", () => {
  it("sends organization members to the dashboard and distributor-only accounts to their portal", () => {
    expect(organizerHome(org)).toBe("/dashboard");
    expect(organizerHome(distributor)).toBe("/distributor");
  });

  it("honours a safe next and ignores an unsafe one", () => {
    expect(organizerDestination(org, "/events/1/settings?tab=ticket-setup")).toBe("/events/1/settings?tab=ticket-setup");
    expect(organizerDestination(org, "https://evil.example/x")).toBe("/dashboard");
    expect(organizerDestination(org, "//evil.example")).toBe("/dashboard");
    expect(organizerDestination(distributor, "/login")).toBe("/distributor");
  });
});

describe("guest page redirect for a signed-in organizer", () => {
  it("goes where the protected layout would", () => {
    expect(organizerGuestRedirect(org, null)).toBe("/dashboard");
    expect(organizerGuestRedirect(org, "/events")).toBe("/events");
    expect(organizerGuestRedirect(distributor, null)).toBe("/distributor");
  });

  it("sends an unverified account to /verify-email, whatever next says", () => {
    expect(organizerGuestRedirect(unverified, "/events")).toBe("/verify-email");
  });
});

describe("consumer destination", () => {
  it("defaults to My tickets and keeps a safe next", () => {
    expect(consumerDestination(null)).toBe("/tickets");
    expect(consumerDestination("/tickets/orders/ABC")).toBe("/tickets/orders/ABC");
    expect(consumerDestination("/dashboard")).toBe("/tickets");
  });
});

describe("nextFromReturnPath", () => {
  it("reads next from the recorded path and query", () => {
    expect(nextFromReturnPath("/organizers/login?expired=1&next=%2Fevents%2F5")).toBe("/events/5");
    expect(nextFromReturnPath("/login")).toBeNull();
    expect(nextFromReturnPath(null)).toBeNull();
  });
});
