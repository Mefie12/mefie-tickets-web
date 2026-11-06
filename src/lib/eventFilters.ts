/**
 * Pure state logic for the Discover filter drawer, kept out of the component
 * so it is unit-testable in the node-only Vitest setup.
 */

export const FILTER_KEYS = ["category", "subcategory", "country", "from", "to"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export type FilterDraft = Record<FilterKey, string>;

export const EMPTY_DRAFT: FilterDraft = { category: "", subcategory: "", country: "", from: "", to: "" };

export function draftFromParams(params: { get(name: string): string | null }): FilterDraft {
  return {
    category: params.get("category") ?? "",
    subcategory: params.get("subcategory") ?? "",
    country: params.get("country") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
  };
}

export function countActiveFilters(draft: FilterDraft): number {
  return FILTER_KEYS.filter((key) => draft[key]).length;
}

/** A subcategory only exists within a category, so changing the category always clears it. */
export function setDraftCategory(draft: FilterDraft, category: string | null): FilterDraft {
  return { ...draft, category: category ?? "", subcategory: "" };
}

/** ISO yyyy-mm-dd strings compare correctly as plain strings. */
export function dateRangeError(draft: Pick<FilterDraft, "from" | "to">): string | null {
  if (draft.from && draft.to && draft.from > draft.to) return "End date must be on or after the start date";
  return null;
}

/**
 * Merges `updates` into the current query string and returns the `/discover` URL.
 * `keepBrowse` keeps the browse/listing view (`all=1`) when the update leaves no
 * filter or search behind — otherwise clearing the last filter would drop the
 * user back onto the curated landing page.
 */
export function buildDiscoverUrl(
  current: URLSearchParams,
  updates: Record<string, string | null>,
  options: { keepBrowse?: boolean } = {},
): string {
  const params = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  params.delete("page");
  if (options.keepBrowse && !["q", ...FILTER_KEYS].some((key) => params.get(key))) {
    params.set("all", "1");
  }
  const query = params.toString();
  return query ? `/discover?${query}` : "/discover";
}
