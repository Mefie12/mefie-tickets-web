/**
 * Event schedules on the wire are a UTC instant plus the IANA zone the
 * organizer scheduled in. Everything here converts UTC -> that zone,
 * for form fields and for display.
 *
 * There is deliberately NO wall-clock -> UTC direction in this file.
 * The server owns that conversion (EventService via WallClock), and it
 * needs to stay the only place it happens — a helpful client-side
 * `toUtc()` here would recreate exactly the ambient-timezone bug this
 * whole design removed (`new Date("2026-09-16T18:00").toISOString()`
 * resolves against the browser's zone, so the same form produced
 * different instants depending on where the organizer was sitting).
 *
 * Every formatter passes an explicit locale. `undefined` resolves to the
 * runtime's locale, and these run in Server Components too — so it would
 * be the Node process's locale, not the viewer's.
 */

const LOCALE = "en-GB";

export type ZonedParts = { date: string; time: string };

/** Compare ISO wall-clock input parts without applying the browser timezone. */
export function wallClockEndIsInvalid(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
): boolean {
  if (!startDate || !endDate) return false;
  if (endDate < startDate) return true;
  return endDate === startDate && Boolean(startTime && endTime) && endTime <= startTime;
}

/** The first valid minute after startTime, or null when the day is exhausted. */
export function nextWallClockMinute(startTime: string): string | null {
  if (!/^\d{2}:\d{2}$/.test(startTime)) return null;
  const [hours, minutes] = startTime.split(":").map(Number);
  const next = hours * 60 + minutes + 1;
  if (next >= 24 * 60) return null;
  return `${String(Math.floor(next / 60)).padStart(2, "0")}:${String(next % 60).padStart(2, "0")}`;
}

/** Minimum for a native end-time input on a same-day range. */
export function minimumEndTime(startDate: string, startTime: string, endDate: string): string | undefined {
  if (!startDate || startDate !== endDate || !startTime) return undefined;
  return nextWallClockMinute(startTime) ?? undefined;
}

/**
 * UTC ISO -> the `YYYY-MM-DD` + `HH:mm` a native date/time input wants,
 * as read in `timeZone`.
 */
export function utcIsoToZonedParts(iso: string, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    // h23, not `hour12: false` — the latter can emit hour "24" for
    // midnight, which no <input type="time"> will accept.
    hourCycle: "h23",
  }).formatToParts(new Date(iso));

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/** Same, but absorbs the null case for optional windows (tier sale windows). */
export function utcIsoToZonedPartsOrEmpty(iso: string | null | undefined, timeZone: string): ZonedParts {
  return iso ? utcIsoToZonedParts(iso, timeZone) : { date: "", time: "" };
}

/**
 * The display string, always in the event's own zone with an explicit
 * label: "Wed 16 Sep 2026, 18:00 – 21:00 GMT+1".
 */
export function formatEventDateRange(startIso: string | null, endIso: string | null, timeZone: string): string {
  if (!startIso || !endIso) return "Date and time TBA";
  const start = new Date(startIso);
  const end = new Date(endIso);

  const dateFmt = new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat(LOCALE, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  const zoneLabel =
    new Intl.DateTimeFormat(LOCALE, { timeZone, timeZoneName: "shortOffset" })
      .formatToParts(start)
      .find((p) => p.type === "timeZoneName")?.value ?? "";

  // Compare the ZONED dates, not Date.toDateString() — that evaluates in
  // the runtime's zone and would disagree with what's displayed.
  const sameDay =
    utcIsoToZonedParts(startIso, timeZone).date === utcIsoToZonedParts(endIso, timeZone).date;

  if (sameDay) {
    return `${dateFmt.format(start)}, ${timeFmt.format(start)} – ${timeFmt.format(end)} ${zoneLabel}`.trim();
  }
  return `${dateFmt.format(start)}, ${timeFmt.format(start)} – ${dateFmt.format(end)}, ${timeFmt.format(end)} ${zoneLabel}`.trim();
}

/** Date only, for compact lists. */
export function formatEventDate(iso: string | null, timeZone: string): string {
  if (!iso) return "Date and time TBA";
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/** Time of day only, e.g. "18:04" — for gate check-in activity timestamps. */
export function formatEventTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(iso),
  );
}
