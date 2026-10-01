import { localInputToUtcIso } from "@/lib/offerDates";

/**
 * Client-side schedule feedback for the offer form, shown when a field is
 * left. UX only — the API enforces the same rules (OfferService::assertConfig).
 *
 * - The start may be at most START_GRACE_MINUTES in the past: the form
 *   defaults to "now", which is already seconds old by the time it is saved.
 *   An unchanged start of an existing draft is never flagged.
 * - The end must be in the future and after the start.
 */
export const START_GRACE_MINUTES = 55;

function instant(local: string, timeZone: string): number | null {
  if (!local || !local.includes("T")) return null;
  const ms = new Date(localInputToUtcIso(local, timeZone)).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function startError(startLocal: string, timeZone: string, opts: { unchangedFrom?: string; now?: number } = {}): string | null {
  const start = instant(startLocal, timeZone);
  if (start === null) return "Choose a start date and time.";
  if (opts.unchangedFrom !== undefined && opts.unchangedFrom === startLocal) return null;
  const now = opts.now ?? Date.now();
  return start < now - START_GRACE_MINUTES * 60_000 ? "The start can’t be in the past." : null;
}

export function endError(startLocal: string, endLocal: string, timeZone: string, now: number = Date.now()): string | null {
  const end = instant(endLocal, timeZone);
  if (end === null) return "Choose an end date and time.";
  if (end <= now) return "The end must be in the future.";
  const start = instant(startLocal, timeZone);
  if (start !== null && end <= start) return "The end must be after the start.";
  return null;
}
