import type { ReactNode } from "react";
import { Box } from "@mantine/core";
import classes from "./saveBar.module.css";

/** Cancel / Save row for a modal form: pinned to the bottom of the modal so it is reachable without scrolling a long form. */
export function ModalActions({ children }: { children: ReactNode }) {
  return <Box className={classes.modalActions}>{children}</Box>;
}
