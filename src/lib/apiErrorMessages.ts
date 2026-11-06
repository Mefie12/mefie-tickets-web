import { ApiError } from "@/lib/authApi";

/**
 * Human copy for the buy-now-assign-later error codes
 * (App\Exceptions\ApiException on the backend). Falls back to the
 * server-provided message, then a generic line. Keep in sync with
 * docs/17 §14 and the *Actions classes.
 */
const MESSAGES: Record<string, string> = {
  // upstream / transport
  UPSTREAM_UNAVAILABLE: "We couldn't reach our servers. Please try again in a moment.",
  UPSTREAM_TIMEOUT: "This is taking longer than usual. Your request may have gone through — check your email, or try again.",
  NETWORK_ERROR: "You appear to be offline. Check your connection and try again.",
  QUESTIONS_CHANGED: "The questions for this event have changed. Please open your invitation link again to see the latest form.",
  IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD: "This invitation was already claimed with different details.",

  // step-up / session
  STEP_UP_REQUIRED: "Please confirm it's you with a fresh code to continue.",
  CONSUMER_SESSION_EXPIRED: "Your session timed out. Open your ticket link again.",
  EMAIL_NOT_ACCEPTED: "We already know which email to use — no need to enter one.",

  // claim links
  CLAIM_LINK_EXPIRED: "This invitation has expired.",
  CLAIM_LINK_REVOKED: "This invitation was withdrawn.",
  CLAIM_LINK_CLAIMED: "This invitation has already been used.",
  CLAIM_LINK_ALREADY_ASSIGNED: "This ticket has already been assigned.",
  CLAIM_SELF_NOT_ALLOWED: "An invitation can't be claimed for the buyer — enter the attendee's details.",
  CLAIM_FLOW_MISSING: "Open the invitation link again.",

  // personal acceptance
  ACCEPT_EXPIRED: "This confirmation link has expired.",
  ACCEPT_ALREADY: "You've already confirmed this ticket.",
  ACCEPT_SUPERSEDED: "This ticket was reassigned, so this link no longer applies.",
  ACCEPT_INVALIDATED: "This ticket is no longer active.",
  ACCEPTANCE_NOT_GIVEN: "Tick the box to accept the admission terms.",
  ACCEPT_FLOW_MISSING: "Open the confirmation link again.",

  // assignment / correction
  ENTITLEMENT_NOT_ASSIGNABLE: "This ticket can't be assigned in its current state.",
  ENTITLEMENT_CHECKED_IN: "This ticket has already been used at the gate.",
  ATTENDEE_NOT_CORRECTABLE: "This attendee's details can't be edited right now.",
  ATTENDEE_CORRECTION_EMPTY: "Change at least one field before saving.",
  NOTHING_TO_REVOKE: "There's nothing to revoke — this ticket isn't assigned.",
  NO_REACCEPTANCE_PENDING: "There's nothing to confirm — you're all set.",
  PAST_ADMISSION_CUTOFF: "Assignment for this event has closed.",

  // organizer config
  DEFERRED_REQUIRES_PAID: "Buy-now-assign-later is only available on events that sell paid tickets.",
  DEFERRED_HAS_UNASSIGNED: "Some buyers still have tickets to assign — you can't turn this off until every ticket on this event is assigned.",

  // refunds
  REFUND_REQUEST_ALREADY_PENDING: "You already have a refund request in review for this order.",
  COMMERCIAL_INVALIDATION_BLOCKED_PENDING_REFUND: "A refund is already being processed for this order.",

  // gate
  TICKET_REVOKED: "This ticket was revoked and can't be used.",
  TICKET_SUSPENDED: "This ticket is on hold (payment dispute) and can't be used.",
  TICKET_PENDING_ACCEPTANCE: "The attendee hasn't confirmed this ticket yet.",
  TICKET_NOT_FOUND: "That code isn't recognised for this list.",
  ALREADY_CHECKED_IN: "Already checked in.",
};

export function resolveApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

/** Like resolveApiErrorMessage, plus a "Reference: <id>" line for server failures so support can find the request. */
export function resolveApiErrorMessageWithReference(error: unknown): string {
  const message = resolveApiErrorMessage(error);
  if (error instanceof ApiError && error.status >= 500 && error.requestId) {
    return `${message} Reference: ${error.requestId}`;
  }
  return message;
}
