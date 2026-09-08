"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Modal } from "@mantine/core";
import {
  consentState,
  readConsent,
  subscribeConsentChange,
  writeConsent,
  type ConsentState,
} from "@/lib/privacyConsent";
import { PrivacyPreferencesPanel } from "@/components/privacy/PrivacyPreferencesPanel";

type PrivacyConsentContextValue = {
  /** UNKNOWN until the visitor has made a valid, current-version choice. */
  state: ConsentState;
  /** False until the mount effect has read storage — gate first paint on this. */
  ready: boolean;
  /** Show the first-visit banner. */
  showBanner: boolean;
  acceptAll: () => void;
  acceptNecessaryOnly: () => void;
  savePreferences: (productImprovement: boolean) => void;
  /** Open the "See details" / re-open panel. Never changes consent by itself. */
  openPreferences: () => void;
  closePreferences: () => void;
};

const PrivacyConsentContext = createContext<PrivacyConsentContextValue | null>(null);

export function PrivacyConsentProvider({ children }: { children: React.ReactNode }) {
  // `ready` starts false and flips post-mount on purpose: the server can't
  // read this browser's storage, so first client paint must match the
  // server (banner hidden) and only then reconcile.
  const [state, setState] = useState<ConsentState>("UNKNOWN");
  const [ready, setReady] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    const sync = () => setState(consentState(readConsent()));
    sync();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
    return subscribeConsentChange(sync);
  }, []);

  const openPreferences = useCallback(() => setPreferencesOpen(true), []);
  const closePreferences = useCallback(() => setPreferencesOpen(false), []);

  const value = useMemo<PrivacyConsentContextValue>(
    () => ({
      state,
      ready,
      showBanner: ready && state === "UNKNOWN",
      acceptAll: () => writeConsent(true),
      acceptNecessaryOnly: () => writeConsent(false),
      savePreferences: (productImprovement: boolean) => writeConsent(productImprovement),
      openPreferences,
      closePreferences,
    }),
    [state, ready, openPreferences, closePreferences],
  );

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
