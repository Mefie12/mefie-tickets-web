"use client";

import { Anchor } from "@mantine/core";
import { usePrivacyConsent } from "@/components/privacy/PrivacyConsentProvider";

/** Persistent "change your choice" affordance (spec §8). Opens the same
 *  preference panel as the banner's "See details". */
export function PrivacyChoicesLink({ style, color }: { style?: React.CSSProperties; /** Text colour, when it must match neighbouring links (Anchor otherwise applies its own). */ color?: string }) {
  const { openPreferences } = usePrivacyConsent();

  return (
    <Anchor
      component="button"
      c={color}
      type="button"
      onClick={openPreferences}
      // A native <button> carries user-agent padding/border a plain <a>
      // doesn't — left unreset, this sits visibly indented next to sibling
      // Link/anchor elements in the same row or list.
      style={{ padding: 0, border: "none", background: "none", fontFamily: "inherit", cursor: "pointer", textAlign: "left", ...style }}
    >
      Privacy choices
    </Anchor>
  );
}
