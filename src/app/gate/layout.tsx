import type { Metadata } from "next";
import { Box } from "@mantine/core";

export const metadata: Metadata = {
  title: "Mefie Gate",
  manifest: "/gate/manifest.webmanifest",
};

/** Bare wrapper for the gate device app. The (session) group adds the shell + guard. */
export default function GateLayout({ children }: { children: React.ReactNode }) {
  return <Box mih="100dvh">{children}</Box>;
}
