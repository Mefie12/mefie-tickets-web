/**
 * Client-side preview of the lane code an organizer would otherwise have
 * to type by hand. Laravel's Str::slug() remains the authority — this
 * only needs to be close enough for a live preview, same as the existing
 * client-side duplicate-name/code checks elsewhere in GateRoutingManager.
 */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents (café -> cafe)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function uniqueSlug(base: string, taken: string[]): string {
  if (base === "") return base;
  const lower = new Set(taken.map((code) => code.trim().toLowerCase()));
  if (!lower.has(base)) return base;
  let n = 2;
  while (lower.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Decides the lane code to show as the organizer types the lane name.
 * Once they've directly edited the code, it stops following the name —
 * the whole "sticky after manual edit" rule lives here, as one pure
 * decision, rather than split across component event handlers, so it's
 * unit-testable without a React rendering setup.
 */
export function nextLaneCode(params: {
  name: string;
  codeEdited: boolean;
  currentCode: string;
  existingCodes: string[];
}): string {
  if (params.codeEdited) return params.currentCode;
  return uniqueSlug(slugify(params.name), params.existingCodes);
}
