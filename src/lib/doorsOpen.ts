import { DOORS_PRESETS } from "@/lib/venueApi";

/** Value of the select: "" = not set, a preset's minutes, or CUSTOM_DOORS. */
export const CUSTOM_DOORS = "custom";

export type DoorsChoice = { choice: string; custom: number | string };

export function isPresetMinutes(minutes: number | null): boolean {
  return minutes !== null && (DOORS_PRESETS as readonly number[]).includes(minutes);
}

/** Splits a stored offset (minutes before start, or null) into the select's choice and the custom box. */
export function doorsChoiceFromMinutes(minutes: number | null): DoorsChoice {
  if (minutes === null) return { choice: "", custom: 20 };
  if (isPresetMinutes(minutes)) return { choice: String(minutes), custom: 20 };

  return { choice: CUSTOM_DOORS, custom: minutes };
}

/** The offset the control currently represents; null = not set. */
export function doorsMinutesFromChoice({ choice, custom }: DoorsChoice): number | null {
  if (choice === "") return null;
  if (choice === CUSTOM_DOORS) return typeof custom === "number" ? custom : Number(custom);

  return Number(choice);
}

export function doorsMinutesInvalid(minutes: number | null): boolean {
  return minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440);
}

/** "45 minutes before", "1 hour before", "90 minutes before" — the label shown in the select. */
export function doorsPresetLabel(minutes: number): string {
  return minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} hour${minutes === 60 ? "" : "s"} before` : `${minutes} minutes before`;
}

/**
 * The clock time doors open, as "HH:mm", from a wall-clock start ("YYYY-MM-DDTHH:mm", in the event's own zone)
 * and the offset. Pure string/arithmetic work: no Date, so no browser-zone surprises. Also reports whether
 * doors land on the day before the start (e.g. a 00:30 start with doors 60 minutes earlier).
 */
export function doorsClockTime(startAt: string, minutes: number | null): { time: string; previousDay: boolean } | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(startAt);
  if (!match || minutes === null || doorsMinutesInvalid(minutes)) return null;
  const startMinutes = Number(match[2]) * 60 + Number(match[3]);
  const total = startMinutes - minutes;
  const previousDay = total < 0;
  const wrapped = ((total % 1440) + 1440) % 1440;

  return { time: `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`, previousDay };
}
