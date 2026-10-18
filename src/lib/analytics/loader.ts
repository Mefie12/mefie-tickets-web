/** Script loading helpers shared by the vendor adapters. */

/** Injects an async script once. Resolves false if it fails (ad blockers): tools must never break the page. */
export function loadScript(src: string): void {
  if (typeof document === "undefined") return;
  if (document.querySelector(`script[src="${src}"]`)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  script.onerror = () => {
    // Blocked by an ad blocker or network: nothing to do, the site works without it.
  };
  document.head.appendChild(script);
}

/** Runs `fn` when the browser is idle so analytics never competes with the page for the main thread. */
export function whenIdle(fn: () => void): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
  if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(fn, { timeout: 3000 });
  else window.setTimeout(fn, 1500);
}

/** Expires a cookie on this host and every parent domain (analytics cookies are usually set on the registrable domain). */
export function expireCookie(name: string): void {
  if (typeof document === "undefined") return;
  const parts = window.location.hostname.split(".");
  const domains = [undefined, ...parts.map((_, i) => parts.slice(i).join(".")).filter((d) => d.includes("."))];
  for (const domain of domains) {
    document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ""}; SameSite=Lax`;
  }
}

/** Expires every cookie whose name matches. */
export function expireCookiesMatching(pattern: RegExp): void {
  if (typeof document === "undefined") return;
  for (const part of document.cookie.split("; ")) {
    const name = part.split("=")[0];
    if (name && pattern.test(name)) expireCookie(name);
  }
}
