"use client";

import type { GateSessionInfo } from "@/lib/gateApi";

/**
 * Client-side hint for gate-app routing. The real auth boundary is the
 * HttpOnly `mefie_gate_session` cookie enforced by Laravel; this only
 * remembers the non-secret session shape (role, capabilities, event
 * title) returned by sign-in so the `/gate/(session)` UI can render the
 * right controls and route away when there is clearly no session. Any
 * gate API call that comes back 401 clears this and bounces to /gate.
 */
const KEY = "mefie_gate_session_info";

export function rememberGateSession(info: GateSessionInfo): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(info));
  } catch {
    /* private mode / storage disabled — the cookie still works */
  }
}

export function readGateSession(): GateSessionInfo | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GateSessionInfo) : null;
  } catch {
    return null;
  }
}

export function clearGateSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* no-op */
  }
}
