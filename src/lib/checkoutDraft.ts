import type { AnswerValue, CreateOrderInput } from "@/lib/checkoutApi";
import type { StoredCartItem } from "@/lib/cartStorage";
import type { PublicQuestion } from "@/lib/publicEventApi";
import { isQuestionAnswered } from "@/components/EditableQuestionField";
import { isValidInternationalPhoneNumber } from "@/lib/phone";

export const DEFERRED_ASSIGNMENT_SUGGESTION_THRESHOLD = 5;
export const ATTENDEE_PAGE_SIZE = 10;

export type AssignmentMode = "now" | "later";
export type SlotAssignment = "me" | "other" | "later" | null;

export type CheckoutCartLine = StoredCartItem & { product_title: string };

export type AttendeeSlot = {
  clientId: string;
  product_id: number;
  ticket_option_id: number | null;
  product_title: string;
  assignment: SlotAssignment;
  assignmentTouched: boolean;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone: string;
  guestAnswers: Record<number, AnswerValue>;
  buyerAnswers: Record<number, AnswerValue>;
  guestTouched: boolean;
  guestAnswersTouched: boolean;
  buyerAnswersTouched: boolean;
};

export type CheckoutDraft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  orderAnswers: Record<number, AnswerValue>;
  notifyAttendees: boolean;
  termsAccepted: boolean;
  assignmentMode: AssignmentMode;
  assignmentInteracted: boolean;
  slots: AttendeeSlot[];
};

export const checkoutLineKey = (productId: number, optionId: number | null) =>
  `${productId}:${optionId ?? "direct"}`;

function newSlot(line: CheckoutCartLine, assignment: SlotAssignment): AttendeeSlot {
  return {
    clientId: crypto.randomUUID(),
    product_id: line.product_id,
    ticket_option_id: line.ticket_option_id,
    product_title: line.product_title,
    assignment,
    assignmentTouched: false,
    guestFirstName: "",
    guestLastName: "",
    guestEmail: "",
    guestPhone: "",
    guestAnswers: {},
    buyerAnswers: {},
    guestTouched: false,
    guestAnswersTouched: false,
    buyerAnswersTouched: false,
  };
}

function suggestedAssignments(total: number): SlotAssignment[] {
  return Array.from({ length: total }, (_, index) => (index === 0 ? "me" : "other"));
}

export function createCheckoutDraft(
  cart: CheckoutCartLine[],
  deferred: boolean,
  inlineAssignmentOffered: boolean,
): CheckoutDraft {
  const total = cart.reduce((sum, line) => sum + line.quantity, 0);
  const suggestions = suggestedAssignments(total);
  let cursor = 0;
  const slots = cart.flatMap((line) =>
    Array.from({ length: line.quantity }, () => {
      const assignment = inlineAssignmentOffered ? suggestions[cursor] : deferred ? "later" : null;
      cursor += 1;
      return newSlot(line, assignment);
    }),
  );

  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    orderAnswers: {},
    notifyAttendees: true,
    termsAccepted: false,
    assignmentMode: deferred
      ? inlineAssignmentOffered && total < DEFERRED_ASSIGNMENT_SUGGESTION_THRESHOLD
        ? "now"
        : "later"
      : "now",
    assignmentInteracted: false,
    slots,
  };
}

export function slotHasAuthoredState(slot: AttendeeSlot): boolean {
  return slot.assignmentTouched
    || slot.guestTouched
    || slot.guestAnswersTouched
    || slot.buyerAnswersTouched
    || !!slot.guestFirstName.trim()
    || !!slot.guestLastName.trim()
    || !!slot.guestEmail.trim()
    || !!slot.guestPhone.trim()
    || Object.keys(slot.guestAnswers).length > 0
    || Object.keys(slot.buyerAnswers).length > 0;
}

export type ReconciliationPlan = {
  autoRemoveIds: string[];
  authoredGroups: { lineKey: string; candidates: AttendeeSlot[]; removalCount: number }[];
};

export function planCartReconciliation(
  slots: AttendeeSlot[],
  nextCart: CheckoutCartLine[],
): ReconciliationPlan {
  const nextCounts = new Map(nextCart.map((line) => [checkoutLineKey(line.product_id, line.ticket_option_id), line.quantity]));
  const currentLines = new Map<string, AttendeeSlot[]>();
  for (const slot of slots) {
    const key = checkoutLineKey(slot.product_id, slot.ticket_option_id);
    currentLines.set(key, [...(currentLines.get(key) ?? []), slot]);
  }

  const autoRemoveIds: string[] = [];
  const authoredGroups: ReconciliationPlan["authoredGroups"] = [];

  for (const [key, lineSlots] of currentLines) {
    let needed = Math.max(0, lineSlots.length - (nextCounts.get(key) ?? 0));
    if (needed === 0) continue;
    const untouched = [...lineSlots].reverse().filter((slot) => !slotHasAuthoredState(slot));
    for (const slot of untouched.slice(0, needed)) autoRemoveIds.push(slot.clientId);
    needed -= Math.min(needed, untouched.length);
    if (needed > 0) {
      authoredGroups.push({
        lineKey: key,
        candidates: lineSlots.filter(slotHasAuthoredState),
        removalCount: needed,
      });
    }
  }

  return { autoRemoveIds, authoredGroups };
}

export function reconcileCheckoutDraft(
  draft: CheckoutDraft,
  nextCart: CheckoutCartLine[],
  removedAuthoredIds: string[],
  deferred: boolean,
  inlineAssignmentOffered: boolean,
): CheckoutDraft {
  const plan = planCartReconciliation(draft.slots, nextCart);
  const removed = new Set([...plan.autoRemoveIds, ...removedAuthoredIds]);
  const existingByLine = new Map<string, AttendeeSlot[]>();
  for (const slot of draft.slots) {
    if (removed.has(slot.clientId)) continue;
    const key = checkoutLineKey(slot.product_id, slot.ticket_option_id);
    existingByLine.set(key, [...(existingByLine.get(key) ?? []), slot]);
  }

  const slots = nextCart.flatMap((line) => {
    const key = checkoutLineKey(line.product_id, line.ticket_option_id);
    const surviving = (existingByLine.get(key) ?? []).slice(0, line.quantity)
      .map((slot) => ({ ...slot, product_title: line.product_title }));
    const added = Array.from({ length: Math.max(0, line.quantity - surviving.length) }, () =>
      newSlot(line, inlineAssignmentOffered ? "other" : deferred ? "later" : null),
    );
    return [...surviving, ...added];
  });

  if (!draft.assignmentInteracted) {
    const total = slots.length;
    return {
      ...draft,
      assignmentMode: deferred
        ? inlineAssignmentOffered && total < DEFERRED_ASSIGNMENT_SUGGESTION_THRESHOLD ? "now" : "later"
        : "now",
      slots: slots.map((slot, index) => ({
        ...slot,
        assignment: inlineAssignmentOffered ? (index === 0 ? "me" : "other") : deferred ? "later" : null,
      })),
    };
  }

  return { ...draft, slots };
}

/** The answers a slot's active identity actually owns — never mixes buyer/guest data. */
export function slotAnswers(slot: AttendeeSlot): Record<number, AnswerValue> {
  return slot.assignment === "me" ? slot.buyerAnswers : slot.guestAnswers;
}

/** Whether the buyer-details section itself has everything a "Me" ticket relies on. */
export function buyerDetailsComplete(draft: CheckoutDraft): boolean {
  return !!draft.firstName.trim()
    && !!draft.lastName.trim()
    && /^\S+@\S+\.\S+$/.test(draft.email)
    && !!draft.phone.trim()
    && isValidInternationalPhoneNumber(draft.phone);
}

/**
 * A "later" slot is always complete (nothing to enter yet); an unset
 * slot never is. A "me" slot isn't complete until the buyer-details
 * section itself is — otherwise a ticket showing "Me" reads as done
 * before the buyer has even entered their own name.
 */
export function slotComplete(slot: AttendeeSlot, attendeeQuestions: PublicQuestion[], draft: CheckoutDraft): boolean {
  if (slot.assignment === "later") return true;
  if (slot.assignment === null) return false;
  if (slot.assignment === "me" && !buyerDetailsComplete(draft)) return false;
  if (slot.assignment === "other" && (!slot.guestFirstName.trim() || !slot.guestLastName.trim())) return false;
  return attendeeQuestions.every((question) => isQuestionAnswered(question, slotAnswers(slot)[question.id]));
}

export type CheckoutQuestionContext = {
  orderQuestions: PublicQuestion[];
  attendeeQuestions: PublicQuestion[];
  termsRequired: boolean;
};

export type CheckoutValidationError = { message: string; slotIndex?: number };

/**
 * Pure mirror of the order-creation preconditions the API itself
 * enforces — lets the UI show a specific, navigable error before ever
 * making the request, rather than surfacing a generic server rejection.
 * Whole-order Later (assignmentMode === "later") skips all per-slot
 * checks, matching "submits no attendees".
 */
export function validateCheckoutDraft(draft: CheckoutDraft, context: CheckoutQuestionContext): CheckoutValidationError | null {
  if (!draft.firstName.trim() || !draft.lastName.trim()) return { message: "Enter your first and last name." };
  if (!/^\S+@\S+\.\S+$/.test(draft.email)) return { message: "Enter a valid email address." };
  if (!draft.phone.trim() || !isValidInternationalPhoneNumber(draft.phone)) return { message: "Enter a valid phone number." };
  if (context.termsRequired && !draft.termsAccepted) return { message: "You must accept the Terms & Conditions to continue." };
  for (const q of context.orderQuestions) {
    if (!isQuestionAnswered(q, draft.orderAnswers[q.id])) return { message: `'${q.title}' is required.` };
  }
  if (draft.assignmentMode === "later") return null;

  for (let index = 0; index < draft.slots.length; index += 1) {
    const slot = draft.slots[index];
    if (slot.assignment === "later") continue;
    if (slot.assignment === null) return { message: `Choose who will use each ${slot.product_title} ticket.`, slotIndex: index };
    if (slot.assignment === "other") {
      if (!slot.guestFirstName.trim() || !slot.guestLastName.trim()) {
        return { message: `Enter a name for each ${slot.product_title} attendee.`, slotIndex: index };
      }
      if (slot.guestEmail.trim() && !/^\S+@\S+\.\S+$/.test(slot.guestEmail)) {
        return { message: "Enter a valid attendee email or leave it blank.", slotIndex: index };
      }
      if (slot.guestPhone.trim() && !isValidInternationalPhoneNumber(slot.guestPhone)) {
        return { message: "Enter a valid attendee phone number or leave it blank.", slotIndex: index };
      }
    }
    const answers = slotAnswers(slot);
    for (const q of context.attendeeQuestions) {
      if (!isQuestionAnswered(q, answers[q.id])) return { message: `'${q.title}' is required for each attendee.`, slotIndex: index };
    }
  }
  return null;
}

/**
 * Builds the exact CreateOrderInput the API expects. Only active
 * (me/other) slots are serialized — a per-ticket or whole-order Later
 * slot is omitted entirely, matching "Per-ticket Later omits that
 * ticket from assignment submission" / "Whole-order Later ... submits
 * no attendees". Never assumed valid — callers should run
 * validateCheckoutDraft() first.
 */
export function serializeCheckoutOrder(
  draft: CheckoutDraft,
  cartItems: CheckoutCartLine[],
  context: CheckoutQuestionContext & { termsVersionId: number | null; checkoutIdempotencyKey: string },
): CreateOrderInput {
  return {
    first_name: draft.firstName,
    last_name: draft.lastName,
    email: draft.email,
    phone: draft.phone,
    checkout_idempotency_key: context.checkoutIdempotencyKey,
    items: cartItems.map(({ product_id, ticket_option_id, quantity }) => ({ product_id, ticket_option_id, quantity })),
    order_answers: context.orderQuestions.map((q) => ({ question_id: q.id, answer: draft.orderAnswers[q.id] ?? "" })),
    notify_attendees: draft.notifyAttendees,
    ...(context.termsRequired && context.termsVersionId !== null
      ? { terms_accepted: draft.termsAccepted, terms_version_id: context.termsVersionId }
      : {}),
    attendees: draft.assignmentMode === "later"
      ? []
      : draft.slots
        .filter((slot) => slot.assignment === "me" || slot.assignment === "other")
        .map((slot) => {
          const me = slot.assignment === "me";
          const answers = me ? slot.buyerAnswers : slot.guestAnswers;
          return {
            product_id: slot.product_id,
            ticket_option_id: slot.ticket_option_id,
            first_name: me ? draft.firstName : slot.guestFirstName,
            last_name: me ? draft.lastName : slot.guestLastName,
            email: me ? draft.email : slot.guestEmail.trim() || null,
            phone: me ? draft.phone : slot.guestPhone.trim() || null,
            is_buyer: me,
            answers: context.attendeeQuestions.map((q) => ({ question_id: q.id, answer: answers[q.id] ?? "" })),
          };
        }),
  };
}
