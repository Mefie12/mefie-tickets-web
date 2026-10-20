import { describe, expect, it } from "vitest";
import {
  EMPTY_DRAFT,
  buildDiscoverUrl,
  countActiveFilters,
  dateRangeError,
  draftFromParams,
  setDraftCategory,
} from "./eventFilters";

describe("eventFilters", () => {
  it("reads the draft from URL params", () => {
    const draft = draftFromParams(new URLSearchParams("category=music&country=gh&from=2026-10-01"));
    expect(draft).toEqual({ category: "music", subcategory: "", country: "gh", from: "2026-10-01", to: "" });
    expect(countActiveFilters(draft)).toBe(3);
  });

  it("clears the subcategory when the category changes", () => {
    const draft = { ...EMPTY_DRAFT, category: "music", subcategory: "afrobeats" };
    expect(setDraftCategory(draft, "sports")).toMatchObject({ category: "sports", subcategory: "" });
    expect(setDraftCategory(draft, null)).toMatchObject({ category: "", subcategory: "" });
  });

  it("rejects an end date before the start date", () => {
    expect(dateRangeError({ from: "2026-10-10", to: "2026-10-01" })).not.toBeNull();
    expect(dateRangeError({ from: "2026-10-01", to: "2026-10-01" })).toBeNull();
    expect(dateRangeError({ from: "2026-10-01", to: "" })).toBeNull();
  });

  it("builds a URL, resetting pagination", () => {
    const url = buildDiscoverUrl(new URLSearchParams("q=jazz&page=3"), { category: "music" });
    expect(url).toBe("/discover?q=jazz&category=music");
  });

  it("keeps the browse view when the last filter is cleared", () => {
    const current = new URLSearchParams("category=music");
    expect(buildDiscoverUrl(current, { category: null })).toBe("/discover");
    expect(buildDiscoverUrl(current, { category: null }, { keepBrowse: true })).toBe("/discover?all=1");
  });

  it("does not add all=1 while a search term remains", () => {
    const current = new URLSearchParams("q=jazz&category=music");
    expect(buildDiscoverUrl(current, { category: null }, { keepBrowse: true })).toBe("/discover?q=jazz");
  });
});
