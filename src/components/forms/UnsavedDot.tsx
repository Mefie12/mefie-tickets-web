import { VisuallyHidden } from "@mantine/core";

/** Amber dot marking a tab with unsaved edits, with hidden text so it isn't conveyed by colour alone. */
export function UnsavedDot() {
  return (
    <>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--mantine-color-yellow-6)", display: "inline-block" }} />
      <VisuallyHidden>(unsaved changes)</VisuallyHidden>
    </>
  );
}
