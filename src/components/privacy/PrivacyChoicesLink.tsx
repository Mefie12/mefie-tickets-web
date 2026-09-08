"use client";

import { Anchor } from "@mantine/core";
import { usePrivacyConsent } from "@/components/privacy/PrivacyConsentProvider";

/** Persistent "change your choice" affordance (spec §8). Opens the same
 *  preference panel as the banner's "See details". */
export function PrivacyChoicesLink({ style }: { style?: React.CSSProperties }) {
  const { openPreferences } = usePrivacyConsent();

  return (
    <Anchor component="button" type="button" onClick={openPreferences} style={style}>
      Privacy choices
    </Anchor>
  );
}
