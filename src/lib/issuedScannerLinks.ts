/**
 * A setup link/QR can only be shown when it is created or re-issued (the server keeps only a hash).
 * The page therefore keeps every freshly issued link on screen until the organizer dismisses it —
 * creating a second scanner must not wipe the first one's QR.
 */
export type IssuedLink = {
  setupId: string;
  heading: string;
  message: string;
  failed: boolean;
  url: string;
  qr: string;
};

export const MAX_ISSUED_LINKS = 6;

/** Newest first. Re-issuing a setup's link replaces its earlier entry, because the old token no longer works. */
export function addIssuedLink(links: IssuedLink[], link: IssuedLink, max = MAX_ISSUED_LINKS): IssuedLink[] {
  return [link, ...links.filter((existing) => existing.setupId !== link.setupId)].slice(0, max);
}

export function dismissIssuedLink(links: IssuedLink[], setupId: string): IssuedLink[] {
  return links.filter((link) => link.setupId !== setupId);
}
