/**
 * Sign-out that never claims more than it knows.
 *
 * A logout request can fail after the server already ended the session (a timeout), or before it
 * ever got there. So an error is not "still signed in": we clear what this tab holds in memory, then
 * ask the server who we are. Signed out → same as success. Still signed in → report failure so the
 * UI can offer Retry instead of announcing a sign-out that did not happen.
 *
 * This is privacy and UX only; the security boundary is the server ending the session.
 */
export type SignOutOutcome = "signed-out" | "failed";

export async function performSignOut(deps: {
  /** The logout request. */
  logout: () => Promise<unknown>;
  /** True when the server still sees a signed-in session. Rejecting counts as "still signed in". */
  stillSignedIn: () => Promise<boolean>;
  /** Drop in-memory client state (the TanStack Query cache). */
  clearClientState: () => void;
}): Promise<SignOutOutcome> {
  try {
    await deps.logout();
  } catch {
    deps.clearClientState();
    const still = await deps.stillSignedIn().catch(() => true);
    return still ? "failed" : "signed-out";
  }
  deps.clearClientState();
  return "signed-out";
}
