/**
 * Pure mapping of the API's 422 `errors` object onto claim-form fields.
 * Keys: first_name, last_name, email, phone, answers.{qid}.answer, answers.{qid}.answer.{part}.
 */
export type ClaimTextField = "first_name" | "last_name" | "email" | "phone";
export type AddressPart = "address_line1" | "city" | "state" | "postal_code" | "country";

const TEXT_FIELDS: ClaimTextField[] = ["first_name", "last_name", "email", "phone"];
const ADDRESS_PARTS: AddressPart[] = ["address_line1", "city", "state", "postal_code", "country"];

export type ClaimFieldErrors = {
  fields: Partial<Record<ClaimTextField, string>>;
  answers: Record<number, string>;
  addressParts: Record<number, Partial<Record<AddressPart, string>>>;
};

export function emptyClaimFieldErrors(): ClaimFieldErrors {
  return { fields: {}, answers: {}, addressParts: {} };
}

export function mapClaimFieldErrors(errors: Record<string, string[] | string> | null | undefined): ClaimFieldErrors {
  const out = emptyClaimFieldErrors();
  if (!errors) return out;

  for (const [key, raw] of Object.entries(errors)) {
    const message = Array.isArray(raw) ? raw[0] : raw;
    if (!message) continue;

    if ((TEXT_FIELDS as string[]).includes(key)) {
      out.fields[key as ClaimTextField] = message;
      continue;
    }

    const match = key.match(/^answers\.(\d+)\.answer(?:\.(\w+))?$/);
    if (!match) continue;
    const id = Number(match[1]);
    const part = match[2];
    if (part && (ADDRESS_PARTS as string[]).includes(part)) {
      out.addressParts[id] = { ...out.addressParts[id], [part]: message };
    } else if (!part) {
      out.answers[id] = message;
    }
  }
  return out;
}

/** True when at least one field has an error. */
export function hasClaimFieldErrors(e: ClaimFieldErrors): boolean {
  return Object.keys(e.fields).length + Object.keys(e.answers).length + Object.keys(e.addressParts).length > 0;
}

/**
 * First field with an error in on-screen order (name, email, phone, then questions in `questionOrder`),
 * as a selector key understood by ClaimForm: `field:first_name` or `question:12`.
 */
export function firstErrorTarget(e: ClaimFieldErrors, questionOrder: number[]): string | null {
  for (const f of TEXT_FIELDS) if (e.fields[f]) return `field:${f}`;
  for (const id of questionOrder) if (e.answers[id] || e.addressParts[id]) return `question:${id}`;
  return null;
}
