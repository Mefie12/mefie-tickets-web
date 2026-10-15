/**
 * Third-party analytics configuration (docs/26, Phase 2b). Every tool loads
 * ONLY if its id is set, so an unset variable is the off switch (also how the
 * advertising pixels stay dormant until the consent wording is signed off).
 *
 * `NEXT_PUBLIC_*` values are inlined at build time and must be referenced
 * statically (no dynamic `process.env[name]`), so changing one needs a redeploy.
 */
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || undefined;
export const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim() || undefined;
// Advertising pixels (built in the next step). Declared here already so the consent model knows
// whether a Marketing choice is on offer in this build.
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || undefined;
export const TIKTOK_PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID?.trim() || undefined;

/**
 * True when at least one advertising pixel is configured in this build. Only
 * then is the "Marketing" choice shown to visitors, so nobody is offered a
 * switch for something that isn't running.
 */
export function isMarketingConfigured(): boolean {
  return Boolean(META_PIXEL_ID || TIKTOK_PIXEL_ID);
}

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || undefined;

/** Names of the configured Product-improvement tools, for the privacy copy (never lists a tool that isn't running). */
export function productImprovementToolNames(): string[] {
  return [GA_MEASUREMENT_ID && "Google Analytics", CLARITY_PROJECT_ID && "Microsoft Clarity", POSTHOG_KEY && "PostHog"].filter((name): name is string => Boolean(name));
}

/** Names of the configured advertising platforms, for the privacy copy. */
export function marketingPlatformNames(): string[] {
  return [META_PIXEL_ID && "Meta", TIKTOK_PIXEL_ID && "TikTok"].filter((name): name is string => Boolean(name));
}

/** "A", "A and B", "A, B and C". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
