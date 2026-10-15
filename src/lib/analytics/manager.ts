import type { ConsentChoices } from "@/lib/privacyConsent";
import { isTrackablePath } from "@/lib/analytics/paths";
import { groupAllowed, type AnalyticsAdapter } from "@/lib/analytics/types";
import { createClarityAdapter } from "@/lib/analytics/adapters/clarity";
import { createGa4Adapter } from "@/lib/analytics/adapters/ga4";
import { CLARITY_PROJECT_ID, GA_MEASUREMENT_ID } from "@/lib/analytics/config";

export type AdapterState = { id: string; group: AnalyticsAdapter["group"]; configured: boolean; resident: boolean; active: boolean };

export type AnalyticsPlan = {
  /** Do a full page load now: a tool's script is still on a page it must not run on, or a stopped tool must be unloaded. */
  reload: boolean;
  start: string[];
  stop: string[];
};

/**
 * The single place that decides what runs, when. Pure so it is unit-tested.
 *
 * A tool runs only when: it is configured, the visitor accepted its consent
 * group, and the current path is a public page (isTrackablePath). A vendor
 * script cannot be unloaded without a page load, so:
 *  - entering a non-public page while any tool's script is resident forces a
 *    full page load (the new page then loads without them);
 *  - after consent was withdrawn (tool stopped but script resident), the next
 *    client-side navigation does the same.
 */
export function planAnalytics(input: { pathname: string; choices: ConsentChoices; adapters: AdapterState[]; pathChanged: boolean }): AnalyticsPlan {
  const { pathname, choices, adapters, pathChanged } = input;
  const trackable = isTrackablePath(pathname);
  const wanted = (a: AdapterState) => a.configured && trackable && groupAllowed(a.group, choices);

  const resident = adapters.filter((a) => a.resident);
  const stoppedResident = resident.filter((a) => !a.active);
  const reload = resident.length > 0 && (!trackable || (stoppedResident.length > 0 && pathChanged));
  if (reload) return { reload: true, start: [], stop: adapters.filter((a) => a.active).map((a) => a.id) };

  return {
    reload: false,
    start: adapters.filter((a) => wanted(a) && !a.active).map((a) => a.id),
    stop: adapters.filter((a) => !wanted(a) && a.active).map((a) => a.id),
  };
}

/** The tools built into this release. Meta and TikTok pixels are added with the shopping events. */
export function createAdapters(): AnalyticsAdapter[] {
  return [createGa4Adapter(GA_MEASUREMENT_ID), createClarityAdapter(CLARITY_PROJECT_ID)];
}
