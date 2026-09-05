"use client";

import { useState } from "react";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/authApi";
import { handleSessionExpiry } from "@/lib/sessionExpiry";
import { theme } from "@/theme";

/**
 * Client-side providers for the whole app.
 *
 * Mantine handles theming/components, TanStack Query handles client-side
 * data fetching and mutations (talking to our own Route Handlers, which
 * proxy to the Laravel API — see app/api/health/route.ts for the pattern).
 *
 * Every query/mutation error passes through handleSessionExpiry first: if
 * the session lapsed while the tab sat open, it hard-redirects to the
 * right sign-in screen instead of letting the UI go stale (see
 * src/lib/sessionExpiry.ts).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: (error) => handleSessionExpiry(error) }),
        mutationCache: new MutationCache({ onError: (error) => handleSessionExpiry(error) }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // A 401 won't recover on retry — go straight to the handler.
            retry: (failureCount, error) =>
              !(error instanceof ApiError && error.status === 401) && failureCount < 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="auto">
        <Notifications position="top-right" />
        <ModalsProvider>{children}</ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}
