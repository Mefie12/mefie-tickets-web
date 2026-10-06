/**
 * "Looks like a real email", for deciding when a form may be submitted (the API still has the final say).
 * One @, no spaces, a dot in the domain, and a top-level part of at least two characters, so "a", "a@", "a@b"
 * and "a@b." are not accepted while the person is still typing.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;

export function isValidEmail(value: string): boolean {
  const email = value.trim();
  return email.length <= 254 && EMAIL_SHAPE.test(email);
}

/**
 * Splits a pasted list ("a@x.com, b@y.com; c@z.com" or one per line) into the addresses that look real and the
 * entries that do not, so a form can name the bad ones instead of sending a batch the server will refuse.
 * Duplicates (ignoring case) are dropped, keeping the first spelling.
 */
export function parseEmailList(text: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const entry of text.split(/[\s,;]+/).map((value) => value.trim()).filter(Boolean)) {
    const key = entry.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    (isValidEmail(entry) ? valid : invalid).push(entry);
  }
  return { valid, invalid };
}

/** Mailbox providers people actually use here; a domain close to one of these (but not equal) is probably a typo. */
const COMMON_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com"];
/** Real providers that sit within two edits of a common one (mail.com is one letter from gmail.com), never "corrected". */
const OTHER_REAL_DOMAINS = new Set([
  "googlemail.com", "mail.com", "email.com", "ymail.com", "rocketmail.com", "live.com", "msn.com", "aol.com", "me.com",
  "mac.com", "pm.me", "proton.me", "protonmail.com", "hey.com", "gmx.com", "gmx.net", "zoho.com", "fastmail.com",
  "yandex.com", "qq.com", "163.com",
]);

/** Optimal-string-alignment distance: single edits plus swapping two neighbouring letters ("gmial" is one step from "gmail"). */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) d[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/**
 * A "did you mean" for a likely mistyped mailbox domain, or null. Only suggests, never blocks: the person decides.
 * Needs a complete-looking address first, and only the domain is corrected (the part before @ is left alone).
 */
export function suggestEmailCorrection(value: string): string | null {
  const email = value.trim();
  if (!isValidEmail(email)) return null;
  const at = email.lastIndexOf("@");
  const domain = email.slice(at + 1).toLowerCase();
  if (COMMON_DOMAINS.includes(domain) || OTHER_REAL_DOMAINS.has(domain)) return null;

  let best: { domain: string; distance: number } | null = null;
  for (const candidate of COMMON_DOMAINS) {
    const distance = editDistance(domain, candidate);
    if (distance <= 2 && (best === null || distance < best.distance)) best = { domain: candidate, distance };
  }
  return best ? `${email.slice(0, at)}@${best.domain}` : null;
}
