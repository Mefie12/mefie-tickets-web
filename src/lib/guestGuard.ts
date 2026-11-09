import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getConsumerSession } from "@/lib/consumerSession";
import { consumerDestination, nextFromReturnPath, organizerGuestRedirect } from "@/lib/postAuthDestination";

/**
 * Could this request belong to a signed-in visitor? Only decides whether it is worth asking the API:
 * it never redirects on its own, so a stale cookie cannot cause a loop (the API has the last word).
 *
 * The names come from deployment config (AUTH_SESSION_COOKIE_NAMES, comma separated: the Laravel
 * session cookie for that environment and the consumer one), plus Laravel's `remember_web_*`.
 * Unset means the gate is off and the API is always asked: slower, but a rename or a missing
 * variable can never quietly skip the guard.
 */
async function mayHaveSession(): Promise<boolean> {
  const names = (process.env.AUTH_SESSION_COOKIE_NAMES ?? "").split(",").map((name) => name.trim()).filter(Boolean);
  if (names.length === 0) return true;
  return (await cookies()).getAll().some((cookie) => names.includes(cookie.name) || cookie.name.startsWith("remember_web_"));
}

/**
 * Guest-only pages (login, register): a visitor who is already signed in is sent straight to where
 * they belong, before anything renders. Each identity is checked on its own (organizer and consumer
 * sessions are separate), using the same destination rules as the protected layouts.
 */
export async function redirectIfSignedIn(kind: "organizer" | "consumer"): Promise<void> {
  if (!(await mayHaveSession())) return;
  const next = nextFromReturnPath((await headers()).get("x-mefie-return-path"));

  if (kind === "organizer") {
    const user = await getCurrentUser();
    if (user) redirect(organizerGuestRedirect(user, next));
    return;
  }
  if (await getConsumerSession()) redirect(consumerDestination(next));
}

/** When this guest page was rendered, handed to GuestRecheck so it can tell a fresh load from a cached copy. */
export function renderedAtMs(): number {
  return Date.now();
}
