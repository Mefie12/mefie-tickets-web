import { describe, expect, it } from "vitest";
import { endOfDayIso, feeAgreementState, percentToBasisPoints, type FeeAgreement } from "@/lib/feeAgreementApi";

const base: FeeAgreement = {
  id: 1,
  organization_id: "org",
  platform_fee_basis_points: 300,
  starts_at: "2026-10-01T00:00:00Z",
  ends_at: null,
  ended_at: null,
  end_reason: null,
  reference: "Contract",
  created_at: "2026-10-01T00:00:00Z",
  creator: null,
  ended_by_user: null,
};

describe("percentToBasisPoints", () => {
  it("converts percent to whole basis points without float drift", () => {
    expect(percentToBasisPoints("2.35")).toBe(235);
    expect(percentToBasisPoints("0.29")).toBe(29);
    expect(percentToBasisPoints("5")).toBe(500);
    expect(percentToBasisPoints(1.1)).toBe(110);
    expect(percentToBasisPoints("0")).toBe(0);
  });

  it("refuses finer-than-0.01% steps, negatives and junk", () => {
    expect(percentToBasisPoints("2.355")).toBeNull();
    expect(percentToBasisPoints("-1")).toBeNull();
    expect(percentToBasisPoints("")).toBeNull();
    expect(percentToBasisPoints("abc")).toBeNull();
    expect(percentToBasisPoints("1e2")).toBeNull();
  });
});

describe("endOfDayIso", () => {
  it("returns an ISO instant for a valid date and null otherwise", () => {
    expect(endOfDayIso("2027-03-31")).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(endOfDayIso("31/03/2027")).toBeNull();
    expect(endOfDayIso("")).toBeNull();
  });
});

describe("feeAgreementState", () => {
  const now = new Date("2026-10-07T12:00:00Z");

  it("classifies open, scheduled-end, lapsed and closed rows", () => {
    expect(feeAgreementState(base, now)).toBe("ACTIVE");
    expect(feeAgreementState({ ...base, ends_at: "2026-12-31T00:00:00Z" }, now)).toBe("SCHEDULED_END");
    expect(feeAgreementState({ ...base, ends_at: "2026-10-01T00:00:00Z" }, now)).toBe("EXPIRED");
    expect(feeAgreementState({ ...base, ended_at: "2026-10-05T00:00:00Z", end_reason: "SUPERSEDED" }, now)).toBe("SUPERSEDED");
    expect(feeAgreementState({ ...base, ended_at: "2026-10-05T00:00:00Z", end_reason: "REVOKED" }, now)).toBe("REVOKED");
  });
});
