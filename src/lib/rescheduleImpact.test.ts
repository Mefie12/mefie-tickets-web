import { describe, expect, it } from "vitest";
import { formatMinorAmount, rescheduleSections, type RescheduleImpact } from "./rescheduleImpact";

const impact = (overrides: Partial<RescheduleImpact> = {}): RescheduleImpact => ({
  has_orders: true,
  orders: 3,
  tickets: 5,
  recipients: 4,
  prepared_scanners: 0,
  unreleased_earnings: { entries: 0, by_currency: [] },
  fixed_sale_windows: 0,
  active_offers: 0,
  current: { start: null, end: null, timezone: "UTC" },
  scan_window_hours: { before_start: 12, after_end: 24 },
  scan_window: null,
  ...overrides,
});
const keys = (i: RescheduleImpact, change = { startChanged: true, endChanged: true }) => rescheduleSections(i, change).map((s) => s.key);

describe("rescheduleSections", () => {
  it("returns nothing when there are no orders", () => {
    expect(rescheduleSections(impact({ has_orders: false }), { startChanged: true, endChanged: true })).toEqual([]);
  });

  it("always warns about attendees and the scan window, with real numbers", () => {
    const sections = rescheduleSections(impact(), { startChanged: true, endChanged: true });
    expect(keys(impact())).toEqual(["attendees", "scan-window"]);
    expect(sections[0].body).toContain("4 people hold 5 tickets");
    expect(sections[0].body).toContain("old date");
    expect(sections[1].body).toContain("12 hours before the start until 24 hours after the end");
  });

  it("uses singular wording for one person and one ticket", () => {
    const [attendees] = rescheduleSections(impact({ recipients: 1, tickets: 1 }), { startChanged: true, endChanged: false });
    expect(attendees.body).toContain("1 person hold 1 ticket");
  });

  it("mentions scanners only when some are prepared", () => {
    expect(keys(impact())).not.toContain("scanners");
    const sections = rescheduleSections(impact({ prepared_scanners: 2 }), { startChanged: true, endChanged: true });
    expect(sections.find((s) => s.key === "scanners")?.body).toContain("2 scanners");
  });

  it("mentions payouts only when the end moves and earnings are unreleased", () => {
    const withEarnings = impact({ unreleased_earnings: { entries: 2, by_currency: [{ currency: "USD", amount_minor: 12500 }] } });
    expect(keys(withEarnings, { startChanged: true, endChanged: false })).not.toContain("payouts");
    expect(keys(impact(), { startChanged: false, endChanged: true })).not.toContain("payouts");
    const payouts = rescheduleSections(withEarnings, { startChanged: false, endChanged: true }).find((s) => s.key === "payouts");
    expect(payouts?.body).toContain("2 unreleased earnings");
    expect(payouts?.body).toContain("US$125.00");
  });

  it("tells the organizer that fixed sale windows and offers do not move", () => {
    expect(keys(impact({ fixed_sale_windows: 1, active_offers: 2 }))).toContain("sales");
    const body = rescheduleSections(impact({ fixed_sale_windows: 1, active_offers: 2 }), { startChanged: true, endChanged: true }).find((s) => s.key === "sales")!.body;
    expect(body).toContain("1 ticket type with fixed sale dates and 2 active offers");
    expect(keys(impact())).not.toContain("sales");
  });
});

describe("formatMinorAmount", () => {
  it("formats minor units and survives an unknown currency code", () => {
    expect(formatMinorAmount(12500, "USD")).toBe("US$125.00");
    expect(formatMinorAmount(1000, "NOPE!")).toBe("10.00 NOPE!");
  });
});
