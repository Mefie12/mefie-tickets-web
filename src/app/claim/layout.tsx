import { Box } from "@mantine/core";

/** Standalone public claim flow — no portal shell, no session. */
export default function ClaimLayout({ children }: { children: React.ReactNode }) {
  return <Box mih="100vh">{children}</Box>;
}
