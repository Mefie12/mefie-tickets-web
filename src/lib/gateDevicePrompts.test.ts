import { describe, expect, it } from "vitest";
import { deviceStatusPrompt } from "@/lib/gateDevicePrompts";

describe("deviceStatusPrompt", () => {
  it("tells the organizer a paused scanner still uploads what it recorded", () => {
    const text = deviceStatusPrompt("Gate B", "PAUSED", 140);

    expect(text).toContain("Pause Gate B?");
    expect(text).toContain("140 check-ins waiting to upload");
    expect(text).toMatch(/still upload/);
    expect(text).toMatch(/resume it at any time/);
    expect(text).toMatch(/offline will not hear/);
  });

  it("warns that retiring strands un-uploaded check-ins and points at pausing instead", () => {
    const text = deviceStatusPrompt("Gate B", "RETIRED", 12);

    expect(text).toContain("cannot be undone");
    expect(text).toContain("12 check-ins waiting to upload");
    expect(text).toMatch(/never be uploaded/);
    expect(text).toMatch(/pause it instead/i);
  });

  it("handles singular, empty and unnamed cases", () => {
    expect(deviceStatusPrompt("Gate B", "PAUSED", 1)).toContain("1 check-in waiting");
    expect(deviceStatusPrompt(null, "PAUSED", 0)).toContain("Pause this scanner?");
    expect(deviceStatusPrompt(null, "PAUSED", null)).toContain("nothing waiting");
    expect(deviceStatusPrompt("  ", "RETIRED", 0)).toContain("Retire this scanner?");
  });
});
