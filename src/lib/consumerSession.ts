import { cache } from "react";
import { backendRequest } from "@/lib/backend";

/**
 * Server-only resolver for the isolated consumer-portal session
 * (`mefie_consumer_session`), mirroring src/lib/session.ts's getCurrentUser
 * for the organizer app. Wrapped in React's cache() so the /tickets
 * (portal) layout guard and any Server Component under it share one
 * Laravel call per request. Fully separate from the Sanctum principal —
 * a signed-in organizer is still anonymous here until they resolve a
 * locator + OTP.
 */
export type ConsumerSession = {
  profile: { email: string; first_name: string; last_name: string };
  step_up_fresh: boolean;
  session_absolute_expires_at: string;
};

export const getConsumerSession = cache(async (): Promise<ConsumerSession | null> => {
  const result = await backendRequest<ConsumerSession>("/api/portal/consumer/state");
  return result.status === 200 ? result.data : null;
});
