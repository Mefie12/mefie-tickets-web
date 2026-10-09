import { describe, expect, it } from "vitest";
import { DOORS_PRESETS, formatInZone, grantStatusPresentation, groupVenueEvents, timeInZone, type VenueEventRow } from "@/lib/venueApi";

const row = (id: number, phase: VenueEventRow["phase"], start: string): VenueEventRow => ({
  id, title: `E${id}`, organizer: "Org", venue_name: null, start_date: start, end_date: null, doors_open_at: null, timezone: "UTC", phase,
});

describe("groupVenueEvents", () => {
  it("splits by phase, soonest first, with past events newest first", () => {
    const grouped = groupVenueEvents([
      row(1, "PAST", "2026-01-01T10:00:00Z"), row(2, "UPCOMING", "2026-12-01T10:00:00Z"), row(3, "UPCOMING", "2026-11-01T10:00:00Z"),
      row(4, "LIVE_NOW", "2026-10-09T10:00:00Z"), row(5, "PAST", "2026-03-01T10:00:00Z"),
    ]);
    expect(grouped.live.map((e) => e.id)).toEqual([4]);
    expect(grouped.upcoming.map((e) => e.id)).toEqual([3, 2]);
    expect(grouped.past.map((e) => e.id)).toEqual([5, 1]);
  });

  it("handles an empty list", () => {
    expect(groupVenueEvents([])).toEqual({ live: [], upcoming: [], past: [] });
  });
});

describe("grantStatusPresentation", () => {
  it("labels every status distinctly, including a lapsed invite", () => {
    const labels = (["ACTIVE", "INVITED", "EXPIRED", "REVOKED"] as const).map((s) => grantStatusPresentation(s).label);
    expect(new Set(labels).size).toBe(4);
    expect(grantStatusPresentation("EXPIRED").label).toBe("Invite expired");
  });
});

describe("zone formatting", () => {
  it("renders in the event's zone, not the viewer's", () => {
    expect(timeInZone("2026-10-09T18:00:00Z", "Africa/Accra")).toBe("18:00:00");
    expect(timeInZone("2026-10-09T18:00:00Z", "Asia/Tokyo")).toBe("03:00:00");
    expect(formatInZone("2026-10-09T23:30:00Z", "Asia/Tokyo")).toContain("08:30");
  });

  it("falls back to UTC for an unknown zone and dashes a missing date", () => {
    expect(timeInZone("2026-10-09T18:00:00Z", "Not/AZone")).toBe("18:00:00 UTC");
    expect(formatInZone(null, "UTC")).toBe("—");
  });
});

describe("DOORS_PRESETS", () => {
  it("stays within the API's 1..1440 minute limit", () => {
    expect(DOORS_PRESETS.every((m) => m >= 1 && m <= 1440)).toBe(true);
  });
});
