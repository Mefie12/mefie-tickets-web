import { describe, expect, it } from "vitest";
import {
  ATTENDEE_PAGE_SIZE,
  DEFERRED_ASSIGNMENT_SUGGESTION_THRESHOLD,
  buyerDetailsComplete,
  createCheckoutDraft,
  planCartReconciliation,
  reconcileCheckoutDraft,
  serializeCheckoutOrder,
  slotComplete,
  slotHasAuthoredState,
  validateCheckoutDraft,
  type AttendeeSlot,
  type CheckoutCartLine,
  type CheckoutDraft,
} from "@/lib/checkoutDraft";
import type { PublicQuestion } from "@/lib/publicEventApi";

const GA: CheckoutCartLine = { product_id: 1, ticket_option_id: null, product_title: "General Admission", quantity: 1 };
const VIP: CheckoutCartLine = { product_id: 2, ticket_option_id: 20, product_title: "VIP — Gold", quantity: 1 };

function line(quantity: number, overrides: Partial<CheckoutCartLine> = {}): CheckoutCartLine {
  return { ...GA, quantity, ...overrides };
}

function baseDraft(overrides: Partial<CheckoutDraft> = {}): CheckoutDraft {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    orderAnswers: {},
    notifyAttendees: true,
    termsAccepted: false,
    assignmentMode: "now",
    assignmentInteracted: false,
    slots: [],
    ...overrides,
  };
}

function withValidBuyer(draft: CheckoutDraft): CheckoutDraft {
  return { ...draft, firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phone: "+14155552671" };
}

function touchSlot(slot: AttendeeSlot, patch: Partial<AttendeeSlot> = {}): AttendeeSlot {
  return { ...slot, ...patch };
}

describe("createCheckoutDraft — suggestion policy", () => {
  it("suggests Now with the sole ticket as Me for a quantity of 1", () => {
    const draft = createCheckoutDraft([line(1)], true, true);
    expect(draft.assignmentMode).toBe("now");
    expect(draft.slots.map((s) => s.assignment)).toEqual(["me"]);
  });

  it.each([2, 3, 4])("suggests Now with the first ticket Me and the rest Someone else for a quantity of %i", (quantity) => {
    const draft = createCheckoutDraft([line(quantity)], true, true);
    expect(draft.assignmentMode).toBe("now");
    expect(draft.slots.map((s) => s.assignment)).toEqual(["me", ...Array(quantity - 1).fill("other")]);
  });

  it(`suggests Later for a quantity at the threshold (${DEFERRED_ASSIGNMENT_SUGGESTION_THRESHOLD})`, () => {
    const draft = createCheckoutDraft([line(DEFERRED_ASSIGNMENT_SUGGESTION_THRESHOLD)], true, true);
    expect(draft.assignmentMode).toBe("later");
  });

  it("remembers per-slot Now selections even while the whole-order mode is Later", () => {
    const draft = createCheckoutDraft([line(DEFERRED_ASSIGNMENT_SUGGESTION_THRESHOLD)], true, true);
    // Later is presentation-only — the underlying suggested selections are still there to restore.
    expect(draft.slots[0].assignment).toBe("me");
    expect(draft.slots[1].assignment).toBe("other");
  });

  it("assigns Me only to the very first ticket overall across mixed product/option lines, not per line", () => {
    const draft = createCheckoutDraft([line(2), { ...VIP, quantity: 2 }], true, true);
    expect(draft.slots.map((s) => s.assignment)).toEqual(["me", "other", "other", "other"]);
  });

  it("suggestions remain editable — nothing is marked as interacted or touched at creation", () => {
    const draft = createCheckoutDraft([line(3)], true, true);
    expect(draft.assignmentInteracted).toBe(false);
    expect(draft.slots.every((s) => !slotHasAuthoredState(s))).toBe(true);
  });

  it("assigns null (must choose) rather than a suggestion for non-deferred events", () => {
    const draft = createCheckoutDraft([line(3)], false, false);
    expect(draft.assignmentMode).toBe("now");
    expect(draft.slots.every((s) => s.assignment === null)).toBe(true);
  });

  it("defers every slot with no suggestion for a deferred event that doesn't offer inline assignment", () => {
    const draft = createCheckoutDraft([line(2)], true, false);
    expect(draft.assignmentMode).toBe("later");
    expect(draft.slots.every((s) => s.assignment === "later")).toBe(true);
  });

  it("gives every slot a unique, stable clientId", () => {
    const draft = createCheckoutDraft([line(3)], true, true);
    const ids = new Set(draft.slots.map((s) => s.clientId));
    expect(ids.size).toBe(3);
  });
});

describe("slotHasAuthoredState", () => {
  it("is false for a freshly suggested slot", () => {
    const draft = createCheckoutDraft([line(2)], true, true);
    expect(slotHasAuthoredState(draft.slots[0])).toBe(false);
    expect(slotHasAuthoredState(draft.slots[1])).toBe(false);
  });

  it("is true once assignmentTouched is set even without a value change", () => {
    const draft = createCheckoutDraft([line(1)], true, true);
    expect(slotHasAuthoredState(touchSlot(draft.slots[0], { assignmentTouched: true }))).toBe(true);
  });

  it("is true once any guest field is filled", () => {
    const draft = createCheckoutDraft([line(2)], true, true);
    expect(slotHasAuthoredState(touchSlot(draft.slots[1], { guestFirstName: "Grace" }))).toBe(true);
  });

  it("is true once guest or buyer answers are touched, even with no answers yet", () => {
    const draft = createCheckoutDraft([line(1)], true, true);
    expect(slotHasAuthoredState(touchSlot(draft.slots[0], { buyerAnswersTouched: true }))).toBe(true);
  });
});

describe("planCartReconciliation", () => {
  it("requires no removals when the line grows or stays the same", () => {
    const draft = createCheckoutDraft([line(2)], true, true);
    const plan = planCartReconciliation(draft.slots, [line(3)]);
    expect(plan.autoRemoveIds).toEqual([]);
    expect(plan.authoredGroups).toEqual([]);
  });

  it("auto-removes untouched slots scanning from the end of the line before asking anything", () => {
    const draft = createCheckoutDraft([line(3)], true, true);
    const plan = planCartReconciliation(draft.slots, [line(1)]);
    // All three are untouched suggestions, so both removals are automatic.
    expect(plan.autoRemoveIds).toHaveLength(2);
    expect(plan.autoRemoveIds).toContain(draft.slots[2].clientId);
    expect(plan.autoRemoveIds).toContain(draft.slots[1].clientId);
    expect(plan.autoRemoveIds).not.toContain(draft.slots[0].clientId);
    expect(plan.authoredGroups).toEqual([]);
  });

  it("never proposes removing an untouched slot ahead of a later untouched one in the same line", () => {
    const draft = createCheckoutDraft([line(4)], true, true);
    const plan = planCartReconciliation(draft.slots, [line(3)]);
    // Only 1 removal needed — must come from the END of the line's order.
    expect(plan.autoRemoveIds).toEqual([draft.slots[3].clientId]);
  });

  it("asks the buyer to choose when authored slots must be removed", () => {
    const draft = createCheckoutDraft([line(3)], true, true);
    const authored = draft.slots.map((s, i) => (i === 0 ? s : touchSlot(s, { guestFirstName: `Guest${i}` })));
    const plan = planCartReconciliation(authored, [line(1)]);
    // Slot 0 is Me (untouched suggestion) -> auto-removed; slots 1 & 2 are authored -> 1 more needed, ask.
    expect(plan.autoRemoveIds).toEqual([authored[0].clientId]);
    expect(plan.authoredGroups).toHaveLength(1);
    expect(plan.authoredGroups[0].removalCount).toBe(1);
    expect(plan.authoredGroups[0].candidates.map((s) => s.clientId)).toEqual([authored[1].clientId, authored[2].clientId]);
  });

  it("marks the choice as uniquely determined when the remaining count equals the candidate count", () => {
    const draft = createCheckoutDraft([line(2)], true, true);
    const authored = draft.slots.map((s, i) => touchSlot(s, { guestFirstName: `Guest${i}` }));
    const plan = planCartReconciliation(authored, [line(0)]);
    expect(plan.authoredGroups[0].removalCount).toBe(plan.authoredGroups[0].candidates.length);
  });

  it("treats a product/option change as removal from the old line plus addition to the new line", () => {
    const draft = createCheckoutDraft([line(1)], true, true);
    const plan = planCartReconciliation(draft.slots, [VIP]);
    // The GA line disappears entirely (not present in nextCart) -> its slot is a removal.
    expect(plan.autoRemoveIds).toEqual([draft.slots[0].clientId]);
  });

  it("plans multiple lines independently", () => {
    const draft = createCheckoutDraft([line(2), { ...VIP, quantity: 2 }], true, true);
    const plan = planCartReconciliation(draft.slots, [line(1), { ...VIP, quantity: 2 }]);
    expect(plan.autoRemoveIds).toHaveLength(1);
    expect(plan.autoRemoveIds[0]).toBe(draft.slots[1].clientId);
  });
});

describe("reconcileCheckoutDraft — pristine vs interacted", () => {
  it("re-applies the suggestion policy across the threshold while pristine", () => {
    const draft = createCheckoutDraft([line(2)], true, true);
    expect(draft.assignmentMode).toBe("now");

    const grown = reconcileCheckoutDraft(draft, [line(DEFERRED_ASSIGNMENT_SUGGESTION_THRESHOLD)], [], true, true);
    expect(grown.assignmentMode).toBe("later");
    expect(grown.slots.map((s) => s.assignment)).toEqual(["me", "other", "other", "other", "other"]);
  });

  it("retains surviving slot IDs when re-suggesting while pristine", () => {
    const draft = createCheckoutDraft([line(2)], true, true);
    const originalFirstId = draft.slots[0].clientId;
    const reconciled = reconcileCheckoutDraft(draft, [line(3)], [], true, true);
    expect(reconciled.slots[0].clientId).toBe(originalFirstId);
  });

  it("never returns to pristine once assignmentInteracted is set", () => {
    const draft = { ...createCheckoutDraft([line(DEFERRED_ASSIGNMENT_SUGGESTION_THRESHOLD)], true, true), assignmentInteracted: true };
    expect(draft.assignmentMode).toBe("later");

    // Shrinking back under the threshold must NOT flip the mode back to "now".
    const reconciled = reconcileCheckoutDraft(draft, [line(2)], [], true, true);
    expect(reconciled.assignmentMode).toBe("later");
  });

  it("preserves an explicit choice after interaction even across a cart change", () => {
    const draft = { ...createCheckoutDraft([line(2)], true, true), assignmentInteracted: true };
    const otherChosen = touchSlot(draft.slots[0], { assignment: "other", assignmentTouched: true, guestFirstName: "Grace" });
    const interacted = { ...draft, slots: [otherChosen, draft.slots[1]] };

    const reconciled = reconcileCheckoutDraft(interacted, [line(3)], [], true, true);
    expect(reconciled.slots[0].assignment).toBe("other");
    expect(reconciled.slots[0].guestFirstName).toBe("Grace");
  });

  it("gives new slots Someone else after interaction, even while whole-order Later is active", () => {
    const draft = { ...createCheckoutDraft([line(1)], true, true), assignmentMode: "later" as const, assignmentInteracted: true };
    const reconciled = reconcileCheckoutDraft(draft, [line(2)], [], true, true);
    expect(reconciled.slots[1].assignment).toBe("other");
    // The mode itself is untouched by reconciliation.
    expect(reconciled.assignmentMode).toBe("later");
  });

  it("never backfills a removed Me slot automatically", () => {
    const draft = { ...createCheckoutDraft([line(2)], true, true), assignmentInteracted: true };
    // Remove the Me slot (slot 0) as an authored removal.
    const reconciled = reconcileCheckoutDraft(draft, [line(1)], [draft.slots[0].clientId], true, true);
    expect(reconciled.slots).toHaveLength(1);
    expect(reconciled.slots[0].assignment).toBe("other");
  });

  it("keeps guest/buyer answer drafts isolated and never copies them between slots", () => {
    const draft = { ...createCheckoutDraft([line(2)], true, true), assignmentInteracted: true };
    const withAnswers = touchSlot(draft.slots[1], { guestAnswers: { 9: "vegetarian" }, guestAnswersTouched: true });
    const interacted = { ...draft, slots: [draft.slots[0], withAnswers] };

    const reconciled = reconcileCheckoutDraft(interacted, [line(3)], [], true, true);
    expect(reconciled.slots[0].guestAnswers).toEqual({});
    expect(reconciled.slots[1].guestAnswers).toEqual({ 9: "vegetarian" });
    expect(reconciled.slots[2].guestAnswers).toEqual({});
  });
});

describe("buyerDetailsComplete / slotComplete", () => {
  it("is false until every buyer field is valid", () => {
    expect(buyerDetailsComplete(baseDraft())).toBe(false);
    expect(buyerDetailsComplete(baseDraft({ firstName: "Ada" }))).toBe(false);
    expect(buyerDetailsComplete(withValidBuyer(baseDraft()))).toBe(true);
  });

  it("a Later slot is always complete", () => {
    const slot = createCheckoutDraft([line(1)], true, false).slots[0];
    expect(slotComplete(slot, [], baseDraft())).toBe(true);
  });

  it("an unset slot is never complete", () => {
    const slot = createCheckoutDraft([line(1)], false, false).slots[0];
    expect(slotComplete(slot, [], baseDraft())).toBe(false);
  });

  it("a Me slot is not complete until the buyer-details section itself is complete", () => {
    const slot = createCheckoutDraft([line(1)], true, true).slots[0];
    expect(slot.assignment).toBe("me");
    expect(slotComplete(slot, [], baseDraft())).toBe(false);
    expect(slotComplete(slot, [], withValidBuyer(baseDraft()))).toBe(true);
  });

  it("a Someone else slot needs a first and last name", () => {
    const slot = createCheckoutDraft([line(2)], true, true).slots[1];
    expect(slot.assignment).toBe("other");
    expect(slotComplete(slot, [], baseDraft())).toBe(false);
    expect(slotComplete(touchSlot(slot, { guestFirstName: "Grace", guestLastName: "Hopper" }), [], baseDraft())).toBe(true);
  });

  it("requires every attendee question to be answered", () => {
    const question: PublicQuestion = { id: 1, title: "Dietary needs", description: null, scope: "ATTENDEE", type: "TEXT", options: null, is_required: true, sort_order: 0 };
    const slot = touchSlot(createCheckoutDraft([line(2)], true, true).slots[1], { guestFirstName: "Grace", guestLastName: "Hopper" });
    expect(slotComplete(slot, [question], baseDraft())).toBe(false);
    expect(slotComplete({ ...slot, guestAnswers: { 1: "None" } }, [question], baseDraft())).toBe(true);
  });
});

describe("validateCheckoutDraft", () => {
  const context = { orderQuestions: [] as PublicQuestion[], attendeeQuestions: [] as PublicQuestion[], termsRequired: false };

  it("requires buyer name, email, and phone", () => {
    expect(validateCheckoutDraft(baseDraft(), context)?.message).toMatch(/first and last name/);
    expect(validateCheckoutDraft(baseDraft({ firstName: "Ada", lastName: "Lovelace" }), context)?.message).toMatch(/email/);
  });

  it("requires terms acceptance only when termsRequired", () => {
    const draft = withValidBuyer(baseDraft({ assignmentMode: "later" }));
    expect(validateCheckoutDraft(draft, { ...context, termsRequired: true })?.message).toMatch(/Terms/);
    expect(validateCheckoutDraft({ ...draft, termsAccepted: true }, { ...context, termsRequired: true })).toBeNull();
  });

  it("skips all per-slot checks when assignmentMode is later", () => {
    const draft = withValidBuyer({ ...baseDraft(), assignmentMode: "later", slots: [{ ...createCheckoutDraft([line(1)], false, false).slots[0] }] });
    expect(validateCheckoutDraft(draft, context)).toBeNull();
  });

  it("requires an explicit choice for every active slot, reporting the first invalid index", () => {
    const draft = withValidBuyer({ ...baseDraft(), slots: createCheckoutDraft([line(3)], false, false).slots });
    const error = validateCheckoutDraft(draft, context);
    expect(error?.slotIndex).toBe(0);
  });

  it("allows a per-ticket Later slot to skip validation", () => {
    const slots = createCheckoutDraft([line(1)], true, true).slots.map((s) => touchSlot(s, { assignment: "later" }));
    const draft = withValidBuyer({ ...baseDraft(), slots });
    expect(validateCheckoutDraft(draft, context)).toBeNull();
  });

  it("requires a name for a Someone else slot", () => {
    const slots = createCheckoutDraft([line(2)], true, true).slots;
    const draft = withValidBuyer({ ...baseDraft(), slots });
    const error = validateCheckoutDraft(draft, context);
    expect(error?.slotIndex).toBe(1);
    expect(error?.message).toMatch(/name/);
  });

  it("rejects an invalid optional guest email but allows a blank one", () => {
    const slots = createCheckoutDraft([line(2)], true, true).slots.map((s, i) => (i === 0 ? s : touchSlot(s, { guestFirstName: "Grace", guestLastName: "Hopper", guestEmail: "not-an-email" })));
    const draft = withValidBuyer({ ...baseDraft(), slots });
    expect(validateCheckoutDraft(draft, context)?.message).toMatch(/valid attendee email/);
    expect(validateCheckoutDraft({ ...draft, slots: slots.map((s, i) => (i === 1 ? { ...s, guestEmail: "" } : s)) }, context)).toBeNull();
  });

  it("requires every attendee question for every active slot", () => {
    const question: PublicQuestion = { id: 5, title: "T-shirt size", description: null, scope: "ATTENDEE", type: "TEXT", options: null, is_required: true, sort_order: 0 };
    const slots = createCheckoutDraft([line(1)], true, true).slots;
    const draft = withValidBuyer({ ...baseDraft(), slots });
    expect(validateCheckoutDraft(draft, { ...context, attendeeQuestions: [question] })?.message).toMatch(/T-shirt size/);
  });

  it("requires every order question", () => {
    const question: PublicQuestion = { id: 7, title: "How did you hear about us", description: null, scope: "ORDER", type: "TEXT", options: null, is_required: true, sort_order: 0 };
    const draft = withValidBuyer(baseDraft({ assignmentMode: "later" }));
    expect(validateCheckoutDraft(draft, { ...context, orderQuestions: [question] })?.message).toMatch(/How did you hear about us/);
  });
});

describe("serializeCheckoutOrder", () => {
  const context = { orderQuestions: [] as PublicQuestion[], attendeeQuestions: [] as PublicQuestion[], termsRequired: false, termsVersionId: null, checkoutIdempotencyKey: "key-1" };

  it("submits no attendees when whole-order Later is active", () => {
    const draft = withValidBuyer({ ...baseDraft(), assignmentMode: "later", slots: createCheckoutDraft([line(3)], true, true).slots });
    const payload = serializeCheckoutOrder(draft, [line(3)], context);
    expect(payload.attendees).toEqual([]);
  });

  it("omits a per-ticket Later slot from submission", () => {
    const slots = createCheckoutDraft([line(2)], true, true).slots.map((s, i) => (i === 1 ? touchSlot(s, { assignment: "later" }) : s));
    const draft = withValidBuyer({ ...baseDraft(), slots });
    const payload = serializeCheckoutOrder(draft, [line(2)], context);
    expect(payload.attendees).toHaveLength(1);
  });

  it("derives a Me attendee's identity from the buyer details, not any guest fields", () => {
    const draft = withValidBuyer({ ...baseDraft(), slots: createCheckoutDraft([line(1)], true, true).slots });
    const payload = serializeCheckoutOrder(draft, [line(1)], context);
    expect(payload.attendees?.[0]).toMatchObject({ first_name: "Ada", last_name: "Lovelace", email: "ada@example.com", is_buyer: true });
  });

  it("derives a Someone else attendee's identity from the slot's own guest fields", () => {
    const slots = createCheckoutDraft([line(2)], true, true).slots.map((s, i) => (i === 0 ? s : touchSlot(s, { guestFirstName: "Grace", guestLastName: "Hopper", guestEmail: "grace@example.com" })));
    const draft = withValidBuyer({ ...baseDraft(), slots });
    const payload = serializeCheckoutOrder(draft, [line(2)], context);
    expect(payload.attendees?.[1]).toMatchObject({ first_name: "Grace", last_name: "Hopper", email: "grace@example.com", is_buyer: false });
  });

  it("references the correct product and option for each attendee", () => {
    const slots = createCheckoutDraft([{ ...VIP, quantity: 1 }], true, true).slots;
    const draft = withValidBuyer({ ...baseDraft(), slots });
    const payload = serializeCheckoutOrder(draft, [{ ...VIP, quantity: 1 }], context);
    expect(payload.attendees?.[0]).toMatchObject({ product_id: VIP.product_id, ticket_option_id: VIP.ticket_option_id });
  });

  it("includes terms acceptance only when required and a version is known", () => {
    const draft = withValidBuyer({ ...baseDraft(), assignmentMode: "later", termsAccepted: true });
    const withoutTerms = serializeCheckoutOrder(draft, [line(1)], context);
    expect(withoutTerms).not.toHaveProperty("terms_accepted");

    const withTerms = serializeCheckoutOrder(draft, [line(1)], { ...context, termsRequired: true, termsVersionId: 3 });
    expect(withTerms).toMatchObject({ terms_accepted: true, terms_version_id: 3 });
  });

  it("keeps buyer and guest answers on the correct side of the identity split", () => {
    const question: PublicQuestion = { id: 2, title: "Dietary needs", description: null, scope: "ATTENDEE", type: "TEXT", options: null, is_required: false, sort_order: 0 };
    const slots = createCheckoutDraft([line(2)], true, true).slots.map((s, i) =>
      i === 0
        ? touchSlot(s, { buyerAnswers: { 2: "vegan" } })
        : touchSlot(s, { guestFirstName: "Grace", guestLastName: "Hopper", guestAnswers: { 2: "none" } }),
    );
    const draft = withValidBuyer({ ...baseDraft(), slots });
    const payload = serializeCheckoutOrder(draft, [line(2)], { ...context, attendeeQuestions: [question] });
    expect(payload.attendees?.[0].answers).toEqual([{ question_id: 2, answer: "vegan" }]);
    expect(payload.attendees?.[1].answers).toEqual([{ question_id: 2, answer: "none" }]);
  });
});

describe("ATTENDEE_PAGE_SIZE", () => {
  it("is a positive constant used to paginate slots", () => {
    expect(ATTENDEE_PAGE_SIZE).toBeGreaterThan(0);
  });
});
