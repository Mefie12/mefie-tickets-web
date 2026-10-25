import { describe, expect, it } from "vitest";
import { isQuestionAnswered } from "@/components/EditableQuestionField";
import type { PublicQuestion } from "@/lib/publicEventApi";

const q = (is_required: boolean): PublicQuestion => ({
  id: 1, title: "Addr", description: null, scope: "ATTENDEE", type: "ADDRESS", options: null, is_required, sort_order: 0,
});
const addr = (o: Partial<Record<string, string>> = {}) => ({ address_line1: "", city: "", state: "", postal_code: "", country: "", ...o });

describe("isQuestionAnswered ADDRESS", () => {
  it("default: required passes with any part filled (unchanged)", () => {
    expect(isQuestionAnswered(q(true), addr({ state: "NY" }))).toBe(true);
    expect(isQuestionAnswered(q(true), addr())).toBe(false);
    expect(isQuestionAnswered(q(false), addr({ state: "NY" }))).toBe(true);
  });

  it("strict: required needs line1 + city + country", () => {
    const o = { strictAddress: true };
    expect(isQuestionAnswered(q(true), addr({ state: "NY" }), o)).toBe(false);
    expect(isQuestionAnswered(q(true), addr({ address_line1: "1 Main", city: "X" }), o)).toBe(false);
    expect(isQuestionAnswered(q(true), addr({ address_line1: "1 Main", city: "X", country: "GH" }), o)).toBe(true);
    expect(isQuestionAnswered(q(true), undefined, o)).toBe(false);
  });

  it("strict: optional must be blank or complete", () => {
    const o = { strictAddress: true };
    expect(isQuestionAnswered(q(false), addr(), o)).toBe(true);
    expect(isQuestionAnswered(q(false), undefined, o)).toBe(true);
    expect(isQuestionAnswered(q(false), addr({ city: "X" }), o)).toBe(false);
    expect(isQuestionAnswered(q(false), addr({ address_line1: "1", city: "X", country: "GH" }), o)).toBe(true);
  });
});
