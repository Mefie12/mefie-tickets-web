/**
 * A short-lived, tab-scoped copy of what an admin had typed into a form when a
 * step-up re-authentication sent them away mid-submit. The original action is
 * deliberately never replayed (see AdminStepUp) — this only puts their words
 * back so they review and press the button again. Contains form text only,
 * never a credential, and expires quickly.
 */
const TTL_MS = 30 * 60 * 1000;

type Stored<T> = { savedAt: number; value: T };

export function saveAdminDraft<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value } satisfies Stored<T>));
  } catch {
    // Storage blocked or full: the admin simply retypes, as before.
  }
}

/** Reads a saved draft without consuming it (safe under React strict-mode double renders); null if absent, stale or unreadable. */
export function peekAdminDraft<T>(key: string, now: number = Date.now()): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored<T>;
    return now - parsed.savedAt <= TTL_MS ? parsed.value : null;
  } catch {
    return null;
  }
}

export function clearAdminDraft(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // nothing to clear
  }
}

/** Errors after which the admin is sent through MFA / password step-up and the request did not run. */
export function isAdminStepUpError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "ADMIN_RECENT_AUTH_REQUIRED" || code === "ADMIN_MFA_REQUIRED";
}
