import { describe, expect, it } from "vitest";
import { emptyClaimFieldErrors, firstErrorTarget, hasClaimFieldErrors, mapClaimFieldErrors } from "@/lib/claimFieldErrors";

describe("mapClaimFieldErrors", () => {
  it("maps plain fields, question answers and address parts", () => {
    const m = mapClaimFieldErrors({
      first_name: ["Required"],
      email: ["Bad email", "second"],
      "answers.12.answer": ["Answer required"],
      "answers.7.answer.city": ["City required"],
      "answers.7.answer.country": ["Country required"],
      unrelated: ["x"],
    });
    expect(m.fields).toEqual({ first_name: "Required", email: "Bad email" });
    expect(m.answers).toEqual({ 12: "Answer required" });
    expect(m.addressParts).toEqual({ 7: { city: "City required", country: "Country required" } });
  });

  it("ignores unknown address parts and empty input", () => {
    expect(hasClaimFieldErrors(mapClaimFieldErrors({ "answers.1.answer.bogus": ["x"] }))).toBe(false);
    expect(mapClaimFieldErrors(undefined)).toEqual(emptyClaimFieldErrors());
  });
});

describe("firstErrorTarget", () => {
  it("prefers contact fields in screen order, then questions in order", () => {
    const m = mapClaimFieldErrors({ "answers.3.answer": ["a"], "answers.9.answer.city": ["b"], phone: ["p"] });
    expect(firstErrorTarget(m, [9, 3])).toBe("field:phone");
    const q = mapClaimFieldErrors({ "answers.3.answer": ["a"], "answers.9.answer.city": ["b"] });
    expect(firstErrorTarget(q, [9, 3])).toBe("question:9");
    expect(firstErrorTarget(emptyClaimFieldErrors(), [1])).toBeNull();
  });
});
