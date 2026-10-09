import { describe, expect, it } from "vitest";
import { CUSTOM_DOORS, doorsChoiceFromMinutes, doorsClockTime, doorsMinutesFromChoice, doorsMinutesInvalid, doorsPresetLabel } from "@/lib/doorsOpen";

describe("doors choice round trip", () => {
  it("maps null, presets and custom values both ways", () => {
    expect(doorsMinutesFromChoice(doorsChoiceFromMinutes(null))).toBeNull();
    expect(doorsMinutesFromChoice(doorsChoiceFromMinutes(45))).toBe(45);
    expect(doorsChoiceFromMinutes(45).choice).toBe("45");
    expect(doorsChoiceFromMinutes(20)).toEqual({ choice: CUSTOM_DOORS, custom: 20 });
    expect(doorsMinutesFromChoice({ choice: CUSTOM_DOORS, custom: "75" })).toBe(75);
  });
});

describe("doorsMinutesInvalid", () => {
  it("accepts 1..1440 whole minutes and null; rejects the rest", () => {
    expect([null, 1, 45, 1440].map(doorsMinutesInvalid)).toEqual([false, false, false, false]);
    expect([0, -5, 1441, 2.5, Number.NaN].map(doorsMinutesInvalid)).toEqual([true, true, true, true, true]);
  });
});

describe("doorsClockTime", () => {
  it("subtracts the offset from the wall-clock start", () => {
    expect(doorsClockTime("2026-12-27T17:00", 45)).toEqual({ time: "16:15", previousDay: false });
    expect(doorsClockTime("2026-12-27T17:00", 120)).toEqual({ time: "15:00", previousDay: false });
  });

  it("flags doors that fall on the previous day", () => {
    expect(doorsClockTime("2026-12-27T00:30", 60)).toEqual({ time: "23:30", previousDay: true });
  });

  it("returns null when there is nothing to show", () => {
    expect(doorsClockTime("", 45)).toBeNull();
    expect(doorsClockTime("2026-12-27T17:00", null)).toBeNull();
    expect(doorsClockTime("2026-12-27T17:00", 5000)).toBeNull();
  });
});

describe("doorsPresetLabel", () => {
  it("reads naturally", () => {
    expect(doorsPresetLabel(30)).toBe("30 minutes before");
    expect(doorsPresetLabel(60)).toBe("1 hour before");
    expect(doorsPresetLabel(120)).toBe("2 hours before");
    expect(doorsPresetLabel(90)).toBe("90 minutes before");
  });
});
