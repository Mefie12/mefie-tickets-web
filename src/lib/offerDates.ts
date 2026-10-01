/**
 * Wall-clock <-> UTC conversion for offer schedules. Organizers type the
 * start/end in the EVENT's timezone (the same way ticket sale windows
 * work), but the API takes UTC instants.
 */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - utcMs;
}

/** "2026-06-01" + "09:30" in `timeZone` -> UTC ISO string. */
export function zonedToUtcIso(date: string, time: string, timeZone: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let utc = guess - zoneOffsetMs(guess, timeZone);
  // Re-check once near DST changes, where the first offset can be off by an hour.
  utc = guess - zoneOffsetMs(utc, timeZone);
  return new Date(utc).toISOString();
}

/** UTC ISO -> the value a `datetime-local` input expects, in `timeZone`. */
export function utcIsoToLocalInput(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** `datetime-local` value ("2026-06-01T09:30") -> UTC ISO in `timeZone`. */
export function localInputToUtcIso(value: string, timeZone: string): string {
  const [date, time] = value.split("T");
  return zonedToUtcIso(date, time ?? "00:00", timeZone);
}
