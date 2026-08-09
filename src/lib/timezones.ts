/**
 * Thin adapter over the runtime's own IANA timezone list — same shape of
 * job as src/lib/countries.ts, but with no npm package needed:
 * `Intl.supportedValuesOf` ships in every current engine.
 *
 * `id` is the canonical IANA identifier and the only value ever stored.
 * `offsetLabel` is decorative — it's DST-dependent and therefore only
 * true "right now", which is exactly why an offset must never be stored
 * in place of the id.
 */
export type Timezone = {
  id: string;
  /** Last path segment, humanized: "America/New_York" -> "New York". */
  label: string;
  /** First path segment: "America". */
  region: string;
  /** e.g. "GMT+1" — as of now, for display only. */
  offsetLabel: string;
  /** Lowercased, slashes/underscores flattened, so "new york" matches. */
  searchText: string;
};

/**
 * Used only if `Intl.supportedValuesOf` is unavailable. A missing
 * property throws a TypeError rather than returning undefined, so the
 * call is guarded and this covers the common cases rather than the app
 * rendering an empty picker.
 */
const FALLBACK_TIMEZONE_IDS = [
  "UTC",
  "Africa/Accra", "Africa/Cairo", "Africa/Johannesburg", "Africa/Lagos", "Africa/Nairobi",
  "America/Anchorage", "America/Bogota", "America/Chicago", "America/Denver", "America/Halifax",
  "America/Los_Angeles", "America/Mexico_City", "America/New_York", "America/Sao_Paulo", "America/Toronto",
  "Asia/Bangkok", "Asia/Dubai", "Asia/Hong_Kong", "Asia/Jakarta", "Asia/Kolkata",
  "Asia/Manila", "Asia/Seoul", "Asia/Shanghai", "Asia/Singapore", "Asia/Tokyo",
  "Australia/Brisbane", "Australia/Melbourne", "Australia/Perth", "Australia/Sydney",
  "Europe/Amsterdam", "Europe/Berlin", "Europe/Dublin", "Europe/Istanbul", "Europe/Lisbon",
  "Europe/London", "Europe/Madrid", "Europe/Moscow", "Europe/Paris", "Europe/Rome",
  "Pacific/Auckland", "Pacific/Honolulu",
];

function supportedTimezoneIds(): string[] {
  if (typeof Intl.supportedValuesOf === "function") {
    try {
      return Intl.supportedValuesOf("timeZone") as string[];
    } catch {
      // fall through
    }
  }
  return FALLBACK_TIMEZONE_IDS;
}

/** "GMT+1" / "GMT-4:30" — computed, never parsed or hardcoded. */
export function offsetLabelFor(timeZone: string, at: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? "";
  } catch {
    return "";
  }
}

function build(): Timezone[] {
  return supportedTimezoneIds()
    .map((id) => {
      const segments = id.split("/");
      return {
        id,
        label: segments[segments.length - 1].replace(/_/g, " "),
        region: segments.length > 1 ? segments[0].replace(/_/g, " ") : "",
        offsetLabel: offsetLabelFor(id),
        searchText: id.toLowerCase().replace(/[/_]/g, " "),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

let cache: Timezone[] | null = null;

/**
 * Lazy and memoized on purpose. Building this constructs ~420
 * Intl.DateTimeFormat instances, which costs real milliseconds — and it
 * must NOT happen at module scope: in Next.js that would evaluate during
 * server render, baking the server's view of "now" (and therefore the
 * DST-dependent offsets) into the client bundle.
 */
export function getTimezones(): Timezone[] {
  return (cache ??= build());
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
