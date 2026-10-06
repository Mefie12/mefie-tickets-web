/** A buyer's refund request as the organizer's review panel receives it. */
export type OrgRefundRequest = {
  id: number;
  status: "PENDING" | "APPROVED" | "DENIED" | "WITHDRAWN";
  reason: string | null;
  decision_note: string | null;
  decided_by: string | null;
  requested_at: string | null;
  decided_at: string | null;
  refund_outcome?: "ISSUED" | "FAILED" | null;
  refund_error_code?: string | null;
  can_retry_refund?: boolean;
};

export type RefundOutcomeLabel = { color: string; label: string; detail: string | null };

/**
 * What an approved request's money movement actually came to. Approval alone says nothing about whether the
 * buyer was refunded, so the organizer is shown the outcome (and, when it failed, what to do about it).
 * Returns null for requests that are not approved.
 */
export function refundOutcomeLabel(request: Pick<OrgRefundRequest, "status" | "refund_outcome" | "refund_error_code">): RefundOutcomeLabel | null {
  if (request.status !== "APPROVED") return null;

  if (request.refund_outcome === "ISSUED") return { color: "teal", label: "Refund issued", detail: null };

  if (request.refund_outcome === "FAILED") {
    switch (request.refund_error_code) {
      case "REFUND_AFTER_TRANSFER_BLOCKED":
        return {
          color: "orange",
          label: "Refund failed",
          detail: "This payment was already paid out to you, so it can't be refunded automatically. Refund this order by hand outside Mefie.",
        };
      case "ORDER_NOT_REFUNDABLE":
        return { color: "orange", label: "Refund failed", detail: "This order has no completed payment to refund. Refund this order by hand outside Mefie." };
      case "REFUND_PROVIDER_ERROR":
        return { color: "orange", label: "Refund failed", detail: "The payment provider returned an error. You can retry the refund." };
      default:
        return { color: "orange", label: "Refund failed", detail: "The refund could not be completed." };
    }
  }

  return { color: "yellow", label: "Refund not confirmed", detail: "We couldn't confirm that the refund went through. You can retry it." };
}
