import { Box } from "@mantine/core";

/** Standalone public personal-acceptance flow — no shell, no session. */
export default function AcceptLayout({ children }: { children: React.ReactNode }) {
  return <Box mih="100vh">{children}</Box>;
}
