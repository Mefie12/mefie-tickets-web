/** Keep authentication redirects local and within the appropriate account context. */
export function safeNext(value: string | null, context: "consumer" | "organizer", fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x20]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://mefie.invalid");
    if (url.origin !== "https://mefie.invalid") return fallback;
    const path = url.pathname;
    const allowed = context === "consumer"
      ? (/^\/tickets(?:\/|$)/.test(path) && !path.startsWith("/tickets/verify"))
        || (/^\/[^/]+\/[^/]+(?:\/[^/]+)?\/?$/.test(path)
          && !new Set(["api", "accept", "admin", "claim", "dashboard", "distributor", "event-series", "events", "forgot-password", "invitations", "login", "organizers", "organization", "register", "reset-password", "settings", "t", "tickets", "verify-email"]).has(path.split("/")[1]))
      : ["/dashboard", "/events", "/event-series", "/organization", "/settings", "/onboarding", "/distributor", "/invitations/accept", "/admin/invitations/accept"].some(base => path === base || path.startsWith(base + "/"));
    return allowed ? url.pathname + url.search : fallback;
  } catch { return fallback; }
}
