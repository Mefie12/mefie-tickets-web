import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safeNext";

describe("safeNext", () => {
  it("lets an organizer-context login return to the venue portal and its invitation page", () => {
    expect(safeNext("/venue", "organizer", "/dashboard")).toBe("/venue");
    expect(safeNext("/venue/events/12", "organizer", "/dashboard")).toBe("/venue/events/12");
    expect(safeNext("/venue/invitations/abc123", "organizer", "/dashboard")).toBe("/venue/invitations/abc123");
  });

  it("never treats /venue as a public organization page for consumers", () => {
    expect(safeNext("/venue/events", "consumer", "/tickets")).toBe("/tickets");
  });

  it("still refuses external and protocol-relative targets", () => {
    expect(safeNext("//evil.example/venue", "organizer", "/dashboard")).toBe("/dashboard");
    expect(safeNext("https://evil.example/venue", "organizer", "/dashboard")).toBe("/dashboard");
    expect(safeNext("/venuehack", "organizer", "/dashboard")).toBe("/dashboard");
  });
});
