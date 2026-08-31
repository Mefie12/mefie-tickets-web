import { Box } from "@mantine/core";

/**
 * Bare wrapper for everything under /tickets. The pre-session screens
 * (/tickets/verify) render inside this; the authenticated portal adds
 * its own shell + guard via the (portal) route group.
 */
export default function TicketsLayout({ children }: { children: React.ReactNode }) {
  return <Box mih="100vh">{children}</Box>;
}
