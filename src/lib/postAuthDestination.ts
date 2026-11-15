import { safeNext } from "@/lib/safeNext";

type DestinationUser = { email_verified_at: string | null; current_organization_id: string | number | null };

/**
 * Where a signed-in organizer account belongs. A distributor-only account (created through the
 * complimentary-allocation invitation flow) never gets an organization membership, so /dashboard
 * would show it a prompt that isn't meant for it.
 */
export function organizerHome(user: Pick<DestinationUser, "current_organization_id">): string {
  return user.current_organization_id === null ? "/distributor" : "/dashboard";
}

/** After a successful login: the validated `next` if there is one, else the account's home. */
export function organizerDestination(user: Pick<DestinationUser, "current_organization_id">, next: string | null): string {
  return safeNext(next, "organizer", organizerHome(user));
}

/**
 * A signed-in organizer landed on a guest-only page (login, register): send them where the
 * protected layout would. An unverified account goes to /verify-email, matching
 * `(organization)/layout.tsx`, so the two guards can never bounce a user between them.
 */
export function organizerGuestRedirect(user: DestinationUser, next: string | null): string {
  return user.email_verified_at ? organizerDestination(user, next) : "/verify-email";
}

/** A signed-in consumer on the buyer sign-in pages. */
export function consumerDestination(next: string | null): string {
  return safeNext(next, "consumer", "/tickets");
}

/** The `next` parameter out of the path-and-query string the proxy records in `x-mefie-return-path`. */
export function nextFromReturnPath(returnPath: string | null): string | null {
  if (!returnPath) return null;
  try {
    return new URL(returnPath, "https://mefie.invalid").searchParams.get("next");
  } catch {
    return null;
  }
}
