/**
 * Storage format for the short-lived `mefie_*_preview` cookies written by handleTokenEntry.
 *
 * They carry organizer/buyer-typed text (event title, ticket name, inviter name, question titles…), so the JSON
 * routinely contains characters outside Latin-1 (curly quotes, dashes, emoji, non-Latin names). As percent-encoded
 * JSON the browser stored it fine, but Next decodes cookies on read — so the raw text then flows wherever the cookie
 * is used. Storing base64url of the UTF-8 JSON keeps the value pure ASCII before AND after Next's decoding, and is
 * slightly smaller on the wire than percent-encoded JSON.
 *
 * Cookies written before this change (plain JSON) are still readable. Uses only TextEncoder/btoa/atob, so it runs
 * the same on Node and Edge.
 */

const PREFIX = "b64.";

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function encodePreviewCookie(value: unknown): string {
  return PREFIX + toBase64Url(JSON.stringify(value));
}

/** The stored object, or `null` for anything missing, malformed, or not a plain object (the cookie is client-controlled). */
export function decodePreviewCookie<T>(raw: string): T | null {
  try {
    const json = raw.startsWith(PREFIX) ? fromBase64Url(raw.slice(PREFIX.length)) : raw;
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as T) : null;
  } catch {
    return null;
  }
}
