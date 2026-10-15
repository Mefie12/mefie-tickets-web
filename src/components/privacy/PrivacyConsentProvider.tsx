"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Modal } from "@mantine/core";
import {
  currentChoices,
  needsDecision,
  readConsent,
  subscribeConsentChange,
  writeConsent,
  type ConsentChoices,
  type StoredConsent,
} from "@/lib/privacyConsent";
import { isMarketingConfigured } from "@/lib/analytics/config";
import { recordConsentProof } from "@/lib/consentProof";
import { PrivacyPreferencesPanel } from "@/components/privacy/PrivacyPreferencesPanel";

type PrivacyConsentContextValue = {
  /** The optional choices in force. Both false until the visitor has made a valid, current-version choice. */
  choices: ConsentChoices;
  /** True while the visitor still has to decide: nothing valid stored, or a marketing tool was enabled after their last choice. */
  decisionNeeded: boolean;
  /** False until the mount effect has read storage — gate first paint on this. */
  ready: boolean;
  /** Show the first-visit banner. */
  showBanner: boolean;
  /** Whether a Marketing choice exists in this build (an advertising pixel is configured). */
  marketingOffered: boolean;
  acceptAll: () => void;
  acceptNecessaryOnly: () => void;
  savePreferences: (choices: ConsentChoices) => void;
  /** Open the "See details" / re-open panel. Never changes consent by itself. */
  openPreferences: () => void;
  closePreferences: () => void;
};

const PrivacyConsentContext = createContext<PrivacyConsentContextValue | null>(null);

export function PrivacyConsentProvider({ children }: { children: React.ReactNode }) {
  // `ready` starts false and flips post-mount on purpose: the server can't
  // read this browser's storage, so first client paint must match the
  // server (banner hidden) and only then reconcile.
  const [stored, setStored] = useState<StoredConsent | null>(null);
  const [ready, setReady] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const marketingOffered = isMarketingConfigured();

  useEffect(() => {
    const sync = () => setStored(readConsent());
    sync();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
    return subscribeConsentChange(sync);
  }, []);

  const openPreferences = useCallback(() => setPreferencesOpen(true), []);
  const closePreferences = useCallback(() => setPreferencesOpen(false), []);

  const value = useMemo<PrivacyConsentContextValue>(() => {
    // Every decision is also recorded (best-effort, no personal data) as proof of consent.
    const decide = (choices: ConsentChoices) => {
      const record = writeConsent(choices);
      if (record) recordConsentProof(record);
    };
    const decisionNeeded = needsDecision(stored, marketingOffered);
    return {
      choices: currentChoices(stored),
      decisionNeeded,
      ready,
      showBanner: ready && decisionNeeded,
      marketingOffered,
      acceptAll: () => decide({ productImprovement: true, marketing: true }),
      acceptNecessaryOnly: () => decide({ productImprovement: false, marketing: false }),
      savePreferences: decide,
      openPreferences,
      closePreferences,
    };
  }, [stored, ready, marketingOffered, openPreferences, closePreferences]);

  return (
    <PrivacyConsentContext.Provider value={value}>
      {children}
      <Modal
        opened={preferencesOpen}
        onClose={closePreferences}
        title="Your privacy choices"
        size="lg"
        // A visitor still deciding can dismiss the panel without choosing —
        // that leaves consent UNKNOWN and the banner in place (spec §6).
      >
        {preferencesOpen && <PrivacyPreferencesPanel />}
      </Modal>
    </PrivacyConsentContext.Provider>
  );
}

export function usePrivacyConsent(): PrivacyConsentContextValue {
  const ctx = useContext(PrivacyConsentContext);
  if (!ctx) throw new Error("usePrivacyConsent must be used within PrivacyConsentProvider");
  return ctx;
}
