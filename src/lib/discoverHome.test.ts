import { describe, expect, it } from "vitest";
import { isDiscoverHome, isPlainLeftClick } from "./discoverHome";

describe("isDiscoverHome", () => {
  it("is true only on /discover with no query", () => {
    expect(isDiscoverHome("/discover", "")).toBe(true);
    expect(isDiscoverHome("/discover/", "")).toBe(true);
    expect(isDiscoverHome("/discover", "?category=music")).toBe(false);
    expect(isDiscoverHome("/discover", "?all=1")).toBe(false);
    expect(isDiscoverHome("/discover", "?q=jazz")).toBe(false);
    expect(isDiscoverHome("/login", "")).toBe(false);
    expect(isDiscoverHome("/", "")).toBe(false);
  });
});

describe("isPlainLeftClick", () => {
  const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
  it("lets modified and non-primary clicks through", () => {
    expect(isPlainLeftClick(click)).toBe(true);
    expect(isPlainLeftClick({ ...click, metaKey: true })).toBe(false);
    expect(isPlainLeftClick({ ...click, ctrlKey: true })).toBe(false);
    expect(isPlainLeftClick({ ...click, button: 1 })).toBe(false);
  });
});
