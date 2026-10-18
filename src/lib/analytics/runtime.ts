import type { AnalyticsAdapter, CommerceEvent } from "@/lib/analytics/types";

/**
 * Module-level bridge between the places that know about shopping moments
 * (checkout, event page) and the controller that owns the live adapters
 * (docs/26, Phase 2b-2). Keeping it here means those components never import
 * a vendor tool and never need to know which tools are running.
 */
let activeProvider: () => AnalyticsAdapter[] = () => [];
let sensitiveStep = false;
const waiting = new Set<() => void>();

/** The controller registers how to read the currently started adapters. */
export function registerActiveAdapters(provider: () => AnalyticsAdapter[]): void {
  activeProvider = provider;
}

/** Sends a shopping event to every started tool that supports it. Returns how many actually sent it. */
export function trackCommerce(event: CommerceEvent): number {
  let sent = 0;
  for (const adapter of activeProvider()) {
    if (typeof adapter.track === "function" && adapter.track(event)) sent += 1;
  }
  return sent;
}

/**
 * The card-entry step is sensitive: advertising pixels are paused while the
 * buyer types payment details and resumed afterwards. Session recorders keep
 * running there, but mask the page (see data-clarity-mask on the checkout).
 */
export function setSensitiveStep(sensitive: boolean): void {
  sensitiveStep = sensitive;
  for (const adapter of activeProvider()) applySensitivity(adapter);
}

/** Pause or resume one marketing adapter to match the current step. Called on every state change and right after a tool starts. */
export function applySensitivity(adapter: AnalyticsAdapter): void {
  if (adapter.group !== "marketing") return;
  if (sensitiveStep) adapter.pause?.();
  else adapter.resume?.();
}

/**
 * Runs `callback` once, as soon as at least one tool is started: immediately
 * if one already is. Page components mount before the controller starts the
 * tools, so a view event must wait for them. Returns an unsubscribe function.
 */
export function whenAnalyticsActive(callback: () => void): () => void {
  if (activeProvider().length > 0) {
    callback();
    return () => {};
  }
  const once = () => {
    waiting.delete(once);
    callback();
  };
  waiting.add(once);
  return () => {
    waiting.delete(once);
  };
}

/** The controller calls this after starting tools. */
export function notifyAnalyticsActive(): void {
  if (activeProvider().length === 0) return;
  for (const callback of [...waiting]) callback();
}
