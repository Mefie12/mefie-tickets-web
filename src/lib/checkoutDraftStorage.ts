import type { AnswerValue } from "@/lib/checkoutApi";
import { slotHasAuthoredState, type AttendeeSlot, type CheckoutDraft, type SlotAssignment } from "@/lib/checkoutDraft";

/**
 * Keeps the checkout details form across a reload (sessionStorage — per
 * tab, gone when the tab closes; nothing is sent to the server until the
 * buyer submits).
 *
 * Privacy and safety rules:
 * - **Consent is never restored.** `termsAccepted` is always false after a
 *   restore, so the Terms & Conditions are accepted in the visit that places
 *   the order.
 * - Only this tab's storage, a short expiry (DRAFT_TTL_MS) and a versioned
 *   envelope; expired, wrong-version or malformed data is discarded.
 * - The stored JSON is never trusted: it is rebuilt field by field with
 *   type checks (sanitizeDraft) rather than cast.
 * - Nothing is written for an untouched form, and the entry is cleared once
 *   the order completes (see CheckoutPage).
 * - The restored draft is then fitted to the current cart by the existing
 *   reconcileCheckoutDraft(), so a changed cart never produces slots that
 *   don't match what is being bought.
 * - Storage failure (private mode, quota) degrades silently.
 */
const VERSION = 1;
export const DRAFT_TTL_MS = 4 * 60 * 60 * 1000;

type Envelope = { v: number; saved_at: number; draft: CheckoutDraft };

const key = (eventId: number) => `mefie-checkout-draft:${eventId}`;

/** Has the buyer entered anything worth keeping? An untouched form is never stored. */
export function draftHasUserInput(draft: CheckoutDraft): boolean {
  return !!draft.firstName.trim() || !!draft.lastName.trim() || !!draft.email.trim() || !!draft.phone.trim()
    || Object.keys(draft.orderAnswers).length > 0
    || draft.assignmentInteracted
    || draft.slots.some(slotHasAuthoredState);
}

export function saveCheckoutDraft(eventId: number, draft: CheckoutDraft, now: number = Date.now()): void {
  try {
    if (!draftHasUserInput(draft)) {
      sessionStorage.removeItem(key(eventId));
      return;
    }
    // Consent is deliberately not persisted.
    const envelope: Envelope = { v: VERSION, saved_at: now, draft: { ...draft, termsAccepted: false } };
    sessionStorage.setItem(key(eventId), JSON.stringify(envelope));
  } catch {
    // Storage unavailable: the details just won't survive a reload.
  }
}

export function clearCheckoutDraft(eventId: number): void {
  try {
    sessionStorage.removeItem(key(eventId));
  } catch {
    // ignore
  }
}

export function loadCheckoutDraft(eventId: number, now: number = Date.now()): CheckoutDraft | null {
  try {
    const raw = sessionStorage.getItem(key(eventId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Envelope>;
    const fresh = parsed?.v === VERSION && typeof parsed.saved_at === "number" && now - parsed.saved_at <= DRAFT_TTL_MS;
    const draft = fresh ? sanitizeDraft(parsed.draft) : null;
    if (!draft) {
      sessionStorage.removeItem(key(eventId));
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

// ---- rebuilding untrusted data -------------------------------------------

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);
const int = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) ? v : null);

function sanitizeAnswer(v: unknown): AnswerValue | null {
  if (typeof v === "string" || typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.every((x) => typeof x === "string") ? (v as string[]) : null;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const keys = ["address_line1", "city", "state", "postal_code", "country"] as const;
    if (keys.every((k) => typeof o[k] === "string")) {
      return Object.fromEntries(keys.map((k) => [k, o[k] as string])) as AnswerValue;
    }
  }
  return null;
}

function sanitizeAnswers(v: unknown): Record<number, AnswerValue> {
  const out: Record<number, AnswerValue> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [k, value] of Object.entries(v as Record<string, unknown>)) {
    const id = Number(k);
    const answer = sanitizeAnswer(value);
    if (Number.isInteger(id) && answer !== null) out[id] = answer;
  }
  return out;
}

const assignment = (v: unknown): SlotAssignment => (v === "me" || v === "other" || v === "later" ? v : null);

function sanitizeSlot(v: unknown): AttendeeSlot | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Record<string, unknown>;
  const productId = int(s.product_id);
  const optionId = s.ticket_option_id === null ? null : int(s.ticket_option_id);
  if (productId === null || (s.ticket_option_id !== null && optionId === null) || typeof s.clientId !== "string" || !s.clientId) return null;
  return {
    clientId: s.clientId,
    product_id: productId,
    ticket_option_id: optionId,
    product_title: str(s.product_title),
    assignment: assignment(s.assignment),
    assignmentTouched: bool(s.assignmentTouched, false),
    guestFirstName: str(s.guestFirstName),
    guestLastName: str(s.guestLastName),
    guestEmail: str(s.guestEmail),
    guestPhone: str(s.guestPhone),
    guestAnswers: sanitizeAnswers(s.guestAnswers),
    buyerAnswers: sanitizeAnswers(s.buyerAnswers),
    guestTouched: bool(s.guestTouched, false),
    guestAnswersTouched: bool(s.guestAnswersTouched, false),
    buyerAnswersTouched: bool(s.buyerAnswersTouched, false),
  };
}

export function sanitizeDraft(v: unknown): CheckoutDraft | null {
  if (!v || typeof v !== "object") return null;
  const d = v as Record<string, unknown>;
  if (!Array.isArray(d.slots)) return null;
  const slots = d.slots.map(sanitizeSlot);
  if (slots.some((s) => s === null)) return null;
  return {
    firstName: str(d.firstName),
    lastName: str(d.lastName),
    email: str(d.email),
    phone: str(d.phone),
    orderAnswers: sanitizeAnswers(d.orderAnswers),
    notifyAttendees: bool(d.notifyAttendees, true),
    termsAccepted: false, // never restored
    assignmentMode: d.assignmentMode === "later" ? "later" : "now",
    assignmentInteracted: bool(d.assignmentInteracted, false),
    slots: slots as AttendeeSlot[],
  };
}
