import { describe, expect, it } from "vitest";
import { currencyExponent, formatMinorAmount, moneyInputProps, toMajorUnits, toMinorUnits, ZERO_DECIMAL_CURRENCIES } from "@/lib/money";

describe("currency minor units", () => {
  it("pins the zero-decimal list to the API's CurrencyMetadata::ZERO_DECIMAL (change both together)", () => {
    expect([...ZERO_DECIMAL_CURRENCIES]).toEqual(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);
  });

  it("knows which currencies have no minor unit, in any letter case", () => {
    expect(currencyExponent("XOF")).toBe(0);
    expect(currencyExponent("ugx")).toBe(0);
    expect(currencyExponent("GBP")).toBe(2);
    expect(currencyExponent("GHS")).toBe(2);
    // The API stores these with 2 decimals even though Intl/CLDR shows 0: follow the API.
    expect(currencyExponent("ISK")).toBe(2);
  });

  it("converts major to minor and back without the x100 assumption", () => {
    expect(toMinorUnits("19.99", "GBP")).toBe(1999);
    expect(toMinorUnits(85, "GBP")).toBe(8500);
    expect(toMinorUnits("5000", "XOF")).toBe(5000);
    expect(toMinorUnits("5000.5", "XOF")).toBe(5001); // half-up, like the API
    expect(toMinorUnits(null, "GBP")).toBe(0);
    expect(toMajorUnits(1999, "GBP")).toBe(19.99);
    expect(toMajorUnits(5000, "XOF")).toBe(5000);
  });

  it("formats server minor amounts in the right magnitude", () => {
    expect(formatMinorAmount(15000, "GBP")).toBe("£150.00");
    expect(formatMinorAmount(5000, "XOF")).toContain("5,000");
    expect(formatMinorAmount(5000, "XOF")).not.toContain("50.00");
    expect(formatMinorAmount(250000, "UGX")).toContain("250,000");
  });

  it("never throws on a missing currency code, falling back to two decimals like before", () => {
    expect(currencyExponent(undefined)).toBe(2);
    expect(currencyExponent(null)).toBe(2);
    expect(() => formatMinorAmount(1999, undefined as unknown as string)).not.toThrow();
    expect(toMinorUnits("19.99", "")).toBe(1999);
  });

  it("gives money inputs whole-number steps for zero-decimal currencies", () => {
    expect(moneyInputProps("XOF")).toEqual({ decimalScale: 0, fixedDecimalScale: false, min: 1 });
    expect(moneyInputProps("GBP")).toEqual({ decimalScale: 2, fixedDecimalScale: true, min: 0.01 });
  });
});
