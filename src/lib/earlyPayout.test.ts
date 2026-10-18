import { describe, expect, it } from "vitest";
import { advanceOutcomeCopy, majorStringToMinor, minorToMajorString, percentOfMax } from "./earlyPayout";

describe("majorStringToMinor", () => {
  it("converts whole and fractional amounts exactly", () => {
    expect(majorStringToMinor("80", "GBP")).toBe(8000);
    expect(majorStringToMinor("80.5", "GBP")).toBe(8050);
    expect(majorStringToMinor("0.07", "GBP")).toBe(7);
    expect(majorStringToMinor(" 12.34 ", "GBP")).toBe(1234);
  });

  it("avoids floating point drift", () => {
    expect(majorStringToMinor("19.99", "GBP")).toBe(1999);
    expect(majorStringToMinor("1.15", "GBP")).toBe(115);
  });

  it("rejects empty, malformed, negative and over-precise input", () => {
    for (const bad of ["", " ", "abc", "-5", "1.234", "1,000", "1e3", ".5", "5."]) {
      expect(majorStringToMinor(bad, "GBP")).toBeNull();
    }
  });
});

describe("minorToMajorString", () => {
  it("round-trips with majorStringToMinor", () => {
    for (const minor of [0, 7, 100, 1234, 8000, 123456]) {
      expect(majorStringToMinor(minorToMajorString(minor, "GBP"), "GBP")).toBe(minor);
    }
    expect(minorToMajorString(7, "GBP")).toBe("0.07");
  });
});

describe("zero-decimal currencies", () => {
  it("take whole numbers only, in the currency's own units", () => {
    expect(majorStringToMinor("5000", "XOF")).toBe(5000);
    expect(majorStringToMinor("5000.50", "XOF")).toBeNull(); // XOF has no minor unit
    expect(majorStringToMinor("12.5", "UGX")).toBeNull();
    expect(minorToMajorString(5000, "XOF")).toBe("5000");
    expect(majorStringToMinor(minorToMajorString(250000, "UGX"), "UGX")).toBe(250000);
  });
});

describe("percentOfMax", () => {
  it("rounds down so a chip can never exceed the cap", () => {
    expect(percentOfMax(8000, 50)).toBe(4000);
    expect(percentOfMax(1001, 25)).toBe(250); // 250.25
    expect(percentOfMax(3, 50)).toBe(1);
    expect(percentOfMax(8000, 100)).toBe(8000);
    expect(percentOfMax(0, 75)).toBe(0);
  });
});

describe("advanceOutcomeCopy", () => {
  it("explains each blocking outcome and falls back safely", () => {
    expect(advanceOutcomeCopy("EXCEEDS_AVAILABLE")).toMatch(/reserve/);
    expect(advanceOutcomeCopy("USE_ROUTINE_RELEASE")).toMatch(/Release eligible funds/);
    expect(advanceOutcomeCopy("ACCOUNT_NOT_READY", "DISCONNECTED")).toMatch(/reconnected/);
    expect(advanceOutcomeCopy("SOMETHING_NEW")).toMatch(/isn't available/);
  });
});
