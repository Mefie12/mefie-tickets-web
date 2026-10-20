/** The logo's destination: the curated Discover landing, with no search, filters or "view all" state. */
export const DISCOVER_HOME = "/discover";

/** True when the visitor is already on the clean Discover landing — i.e. a logo click has nowhere to go but the top. */
export function isDiscoverHome(pathname: string, search: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return normalized === DISCOVER_HOME && new URLSearchParams(search).size === 0;
}

/** Plain left-click only — modified clicks (new tab/window) keep their normal link behaviour. */
export function isPlainLeftClick(event: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}
