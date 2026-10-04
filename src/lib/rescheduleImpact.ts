/** What changing an event's date touches, as counts from GET /api/events/{id}/reschedule-impact. */
export type RescheduleImpact = {
  has_orders: boolean;
  orders: number;
  tickets: number;
  recipients: number;
  prepared_scanners: number;
  unreleased_earnings: { entries: number; by_currency: { currency: string; amount_minor: number }[] };
  fixed_sale_windows: number;
  active_offers: number;
  current: { start: string | null; end: string | null; timezone: string };
  scan_window_hours: { before_start: number; after_end: number };
  scan_window: { from: string; until: string } | null;
};

export type RescheduleSection = { key: string; tone: "red" | "orange" | "blue"; title: string; body: string };

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export function formatMinorAmount(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

/**
 * The warnings an organizer must read before moving the dates of an event people have paid for. Only the
 * sections that apply are returned, each with the real numbers, so the notice is specific rather than generic.
 */
export function rescheduleSections(impact: RescheduleImpact, change: { startChanged: boolean; endChanged: boolean }): RescheduleSection[] {
  if (!impact.has_orders) return [];
  const sections: RescheduleSection[] = [];

  sections.push({
    key: "attendees",
    tone: "red",
    title: "Your attendees",
    body:
      `${plural(impact.recipients, "person", "people")} hold ${plural(impact.tickets, "ticket")}. Their tickets stay valid and nobody needs a new QR code, ` +
      "but a ticket PDF someone already received still shows the old date. Nobody is told about the change unless you email them below.",
  });

  if (impact.prepared_scanners > 0) {
    sections.push({
      key: "scanners",
      tone: "orange",
      title: "Gate scanners",
      body:
        `${plural(impact.prepared_scanners, "scanner")} already set up for this event will only learn the new dates when online. ` +
        "Ask your gate staff to connect them to the internet before doors open.",
    });
  }

  const earnings = impact.unreleased_earnings;
  if (change.endChanged && earnings.entries > 0) {
    const amounts = earnings.by_currency.map((row) => formatMinorAmount(row.amount_minor, row.currency)).join(", ");
    sections.push({
      key: "payouts",
      tone: "orange",
      title: "Your payouts",
      body:
        `${plural(earnings.entries, "unreleased earning")} (${amounts}) will be held until the new end date plus the hold period. ` +
        "Earnings already released or being transferred are not affected.",
    });
  }

  if (impact.fixed_sale_windows > 0 || impact.active_offers > 0) {
    const parts = [
      impact.fixed_sale_windows > 0 ? `${plural(impact.fixed_sale_windows, "ticket type")} with fixed sale dates` : null,
      impact.active_offers > 0 ? plural(impact.active_offers, "active offer") : null,
    ].filter(Boolean);
    sections.push({
      key: "sales",
      tone: "blue",
      title: "Ticket sales and offers",
      body: `You have ${parts.join(" and ")}. They keep their current dates and do not move with the event, so check them after saving.`,
    });
  }

  sections.push({
    key: "scan-window",
    tone: "blue",
    title: "When tickets can be scanned",
    body:
      `Scanning is allowed from ${plural(impact.scan_window_hours.before_start, "hour")} before the start until ` +
      `${plural(impact.scan_window_hours.after_end, "hour")} after the end, so this window moves with the new dates.`,
  });

  return sections;
}
