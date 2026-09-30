import { describe, expect, it } from "vitest";
import { nextLaneCode, slugify, uniqueSlug } from "@/lib/laneSlug";

describe("slugify", () => {
  it("collapses spaces and repeated/mixed punctuation into single hyphens and trims edges", () => {
    expect(slugify("VIP!!  Row -- 1")).toBe("vip-row-1");
  });

  it("strips accents", () => {
    expect(slugify("Café Entrance")).toBe("cafe-entrance");
  });

  it("returns an empty string when there are no sluggable characters", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("")).toBe("");
  });
});

describe("uniqueSlug", () => {
  it("returns the base slug unchanged when it isn't taken", () => {
    expect(uniqueSlug("vip", [])).toBe("vip");
  });

  it("walks past existing collisions in order", () => {
    expect(uniqueSlug("vip", ["vip", "vip-2", "vip-3"])).toBe("vip-4");
  });

  it("compares case-insensitively against the taken list", () => {
    expect(uniqueSlug("vip", ["VIP"])).toBe("vip-2");
  });

  it("never suffixes an empty base", () => {
    expect(uniqueSlug("", ["vip"])).toBe("");
  });
});

describe("nextLaneCode", () => {
  it("follows the name when the code hasn't been manually edited", () => {
    expect(nextLaneCode({ name: "VIP One", codeEdited: false, currentCode: "", existingCodes: [] }))
      .toBe("vip-one");
  });

  it("auto-suffixes a name that collides with an existing lane code on the same entrance", () => {
    expect(nextLaneCode({ name: "VIP", codeEdited: false, currentCode: "", existingCodes: ["vip"] }))
      .toBe("vip-2");
  });

  it("keeps the current code unchanged once the user has edited it directly, even as the name keeps changing", () => {
    expect(nextLaneCode({
      name: "VIP Two", codeEdited: true, currentCode: "my-custom-code", existingCodes: [],
    })).toBe("my-custom-code");
  });
});
