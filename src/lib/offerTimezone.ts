import { offsetLabelFor } from "@/lib/timezones";

/** "Europe/London (GMT+1)" — the event's zone, spelled out next to every schedule input. */
export function offerTimezoneLabel(timezone: string): string {
  try {
    return `${timezone.replaceAll("_", " ")} (${offsetLabelFor(timezone)})`;
  } catch {
    return timezone;
  }
}
