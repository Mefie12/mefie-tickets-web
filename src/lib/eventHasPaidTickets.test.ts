import { describe, expect, it } from "vitest";
import { eventHasPaidTickets, type PublicProduct } from "@/lib/publicEventApi";

const product = (type: PublicProduct["type"]) => ({ type }) as PublicProduct;

describe("eventHasPaidTickets", () => {
  it("is false when every ticket is free", () => {
    expect(eventHasPaidTickets({ products: [product("FREE"), product("FREE")] })).toBe(false);
  });

  it("is false for registration-only events", () => {
    expect(eventHasPaidTickets({ products: [product("REGISTRATION")] })).toBe(false);
  });

  it("is false when there are no products", () => {
    expect(eventHasPaidTickets({ products: [] })).toBe(false);
  });

  it("is true when any ticket costs money, including mixed free + paid events", () => {
    expect(eventHasPaidTickets({ products: [product("FREE"), product("PAID")] })).toBe(true);
    expect(eventHasPaidTickets({ products: [product("TIERED")] })).toBe(true);
    expect(eventHasPaidTickets({ products: [product("DONATION")] })).toBe(true);
  });
});
