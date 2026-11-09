/**
 * Should a click on this link be held to ask about unsaved changes, and where would it go?
 * Pure so it can be tested. Returns the in-app destination (path + query + hash), or null when the
 * click should go ahead untouched: modified/middle clicks and new-tab links (nothing is lost),
 * downloads, other sites (the browser's own leave prompt covers those), and links that stay on
 * this exact page.
 */
export type LinkClick = {
  href: string;
  target: string | null;
  download: boolean;
  button: number;
  modified: boolean;
};

export function linkGuardTarget(click: LinkClick, current: { origin: string; pathname: string; search: string }): string | null {
  if (click.button !== 0 || click.modified || click.download) return null;
  if (click.target && click.target !== "_self") return null;
  let url: URL;
  try {
    url = new URL(click.href, `${current.origin}${current.pathname}${current.search}`);
  } catch {
    return null;
  }
  if (url.origin !== current.origin) return null;
  if (url.pathname === current.pathname && url.search === current.search) return null; // same page, or just a #hash
  return `${url.pathname}${url.search}${url.hash}`;
}
