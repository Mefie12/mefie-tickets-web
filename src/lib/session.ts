import { cache } from "react";
import { backendRequest } from "@/lib/backend";
import type { CurrentUser } from "@/lib/authApi";

/**
 * Wrapped in React's cache() so the (admin) layout's auth guard and any
 * page under it that also needs the current user share one Laravel call
 * per request, instead of each Server Component fetching it separately.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const result = await backendRequest<{ user: CurrentUser }>("/api/users/me");
  return result.status === 200 ? result.data.user : null;
});
