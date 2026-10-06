import { describe, expect, it } from "vitest";
import { gateStatusHint, routingBlockReasons, routingErrorMessages } from "@/lib/gateStatusHint";

describe("gateStatusHint", () => {
  it("returns null for an item that is already live", () => {
    expect(gateStatusHint({ kind: "lane", status: "ACTIVE", eventStatus: "LIVE" })).toBeNull();
  });

  it("says a draft event's entrance publishes with the event", () => {
    expect(gateStatusHint({ kind: "entrance", status: "CONFIGURING", eventStatus: "DRAFT" }))
      .toBe("Not published yet. This entrance goes live when the event is published.");
  });

  it("tells a live event's lane to be routed and published", () => {
    expect(gateStatusHint({ kind: "lane", status: "CONFIGURING", eventStatus: "LIVE" }))
      .toContain("Route a ticket type to this lane");
  });

  it("points a live event's entrance at its lanes", () => {
    expect(gateStatusHint({ kind: "entrance", status: "CONFIGURING", eventStatus: "LIVE" }))
      .toContain("one of its lanes");
  });

  it("explains that an ended event cannot publish routing changes", () => {
    expect(gateStatusHint({ kind: "lane", status: "CONFIGURING", eventStatus: "ENDED" }))
      .toContain("only available for live events");
  });
});

describe("routingBlockReasons", () => {
  const blocked = { allowed: false, reasons: ["not live", "scanner prepared"] };

  it("lists every reason when a published change is blocked", () => {
    expect(routingBlockReasons({ structureEditable: false, routingChanges: blocked })).toEqual(["not live", "scanner prepared"]);
  });

  it("reports nothing for a draft event that edits routing directly", () => {
    expect(routingBlockReasons({ structureEditable: true, routingChanges: blocked })).toEqual([]);
  });

  it("reports nothing when allowed or when the API did not send the field", () => {
    expect(routingBlockReasons({ structureEditable: false, routingChanges: { allowed: true, reasons: [] } })).toEqual([]);
    expect(routingBlockReasons({ structureEditable: false, routingChanges: undefined })).toEqual([]);
  });
});

describe("routingErrorMessages", () => {
  it("returns every routing error the API sent", () => {
    expect(routingErrorMessages({ errors: { routing: ["a", "b"] } }, "x")).toEqual(["a", "b"]);
  });

  it("falls back to the error message, then the fallback", () => {
    expect(routingErrorMessages(new Error("boom"), "x")).toEqual(["boom"]);
    expect(routingErrorMessages("nope", "fallback")).toEqual(["fallback"]);
  });
});
