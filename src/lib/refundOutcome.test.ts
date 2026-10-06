import { describe, expect, it } from "vitest";
import { refundOutcomeLabel } from "./refundOutcome";

const approved = (refund_outcome: "ISSUED" | "FAILED" | null | undefined, refund_error_code: string | null = null) =>
  refundOutcomeLabel({ status: "APPROVED", refund_outcome, refund_error_code });

describe("refundOutcomeLabel", () => {
  it("shows nothing unless the request was approved", () => {
    for (const status of ["PENDING", "DENIED", "WITHDRAWN"] as const) {
      expect(refundOutcomeLabel({ status, refund_outcome: null, refund_error_code: null })).toBeNull();
    }
  });

  it("confirms an issued refund", () => {
    expect(approved("ISSUED")).toEqual({ color: "teal", label: "Refund issued", detail: null });
  });

  it("tells the organizer to refund by hand when the money was already paid out or there is no payment", () => {
    expect(approved("FAILED", "REFUND_AFTER_TRANSFER_BLOCKED")?.detail).toMatch(/by hand outside Mefie/);
    expect(approved("FAILED", "ORDER_NOT_REFUNDABLE")?.detail).toMatch(/by hand outside Mefie/);
  });

  it("offers a retry for a provider error and describes unknown failures generically", () => {
    expect(approved("FAILED", "REFUND_PROVIDER_ERROR")?.detail).toMatch(/retry/i);
    expect(approved("FAILED", "SOMETHING_NEW")).toEqual({ color: "orange", label: "Refund failed", detail: "The refund could not be completed." });
  });

  it("flags an approved request whose refund was never confirmed", () => {
    expect(approved(null)).toMatchObject({ color: "yellow", label: "Refund not confirmed" });
    expect(approved(undefined)).toMatchObject({ label: "Refund not confirmed" });
  });
});
