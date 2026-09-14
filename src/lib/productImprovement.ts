/**
 * The single gated integration point for the "Product improvement" consent
 * category (spec §4, §12). Nothing in here runs until the visitor has
 * chosen "Accept all" — `ProductImprovementController` calls
 * `enableProductImprovement()` only when consent state is ALL_ACCEPTED and
 * `disableProductImprovement()` otherwise.
 *
 * V1 wires PostHog (product analytics + sampled, masked session replay).
 * If `NEXT_PUBLIC_POSTHOG_KEY` is unset every export is a no-op, so the
 * consent UI still works with nothing loaded (spec §18).
 */

type PostHog = (typeof import("posthog-js"))["default"];

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

let client: PostHog | null = null;
let initialised = false;

/** Keep the raw {token} segment of the sensitive entry routes out of analytics. */
function scrubTokenPaths<T extends { properties?: Record<string, unknown> } | null>(event: T): T {
  const props = event?.properties;
  if (!props) return event;
  for (const key of ["$current_url", "$pathname", "$referrer", "$initial_current_url"]) {
    const value = props[key];
    if (typeof value === "string") {
      props[key] = value.replace(/\/(t|claim|accept)\/[^/?#]+/g, "/$1/:token");
    }
  }
  return event;
}

export async function enableProductImprovement(): Promise<void> {
  if (typeof window === "undefined" || !KEY) return;

  if (initialised && client) {
    client.opt_in_capturing();
    client.startSessionRecording?.();
    return;
  }

  const { default: posthog } = await import("posthog-js");
  posthog.init(KEY, {
    api_host: HOST,
    // V1 never calls identify(), so don't mint a person profile per
    // anonymous visitor.
    person_profiles: "identified_only",
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    // Error monitoring stays with Sentry and is classed Necessary — don't
    // double-collect it here.
    capture_exceptions: false,
    session_recording: {
      maskAllInputs: true,
      maskInputOptions: { password: true },
    },
    before_send: (event) => scrubTokenPaths(event),
  });
  client = posthog;
  initialised = true;
}

export function disableProductImprovement(): void {
  if (!initialised || !client) return;
  try {
    client.stopSessionRecording?.();
    client.opt_out_capturing();
    // Clears PostHog's own cookies/localStorage. Already-collected data on
    // the server is not touched (spec §8).
    client.reset(true);
  } catch {
    // ignore
  }
}
