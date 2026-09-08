"use client";

import { useEffect } from "react";
import { usePrivacyConsent } from "@/components/privacy/PrivacyConsentProvider";
import { disableProductImprovement, enableProductImprovement } from "@/lib/productImprovement";

/**
 * Bridges consent state to the Product improvement technologies (spec §12).
 * ALL_ACCEPTED starts PostHog; any other state stops future collection.
 * Runs on mount too, so a returning visitor who already accepted resumes
 * without re-consenting.
 */
export function ProductImprovementController() {
  const { state, ready } = usePrivacyConsent();

  useEffect(() => {
    if (!ready) return;
    if (state === "ALL_ACCEPTED") {
      void enableProductImprovement();
    } else {
      disableProductImprovement();
    }
  }, [state, ready]);

  return null;
}
