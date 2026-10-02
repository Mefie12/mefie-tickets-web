import { isIP } from "node:net";

type HeaderReader = { get(name: string): string | null };

/**
 * The visitor's IP as seen by the platform edge in front of this Next.js server, or null when it can't be
 * established. The API uses it so per-IP rate limits are per visitor instead of one bucket for the web server.
 *
 * X-Forwarded-For is a list that each proxy appends to; everything left of the proxies we control is whatever
 * the browser chose to send. So we count `trustedHops` entries from the RIGHT (1 = the address the nearest
 * proxy saw) and never read the leftmost value. Anything that isn't a valid IP is rejected.
 */
export function clientIpFromHeaders(headers: HeaderReader, trustedHops = 1): string | null {
  const hops = Number.isInteger(trustedHops) && trustedHops >= 1 ? trustedHops : 1;
  const entries = (headers.get("x-forwarded-for") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  const candidate = entries.length >= hops ? entries[entries.length - hops] : (headers.get("x-real-ip") ?? "").trim();
  return candidate && isIP(candidate) !== 0 ? candidate : null;
}
