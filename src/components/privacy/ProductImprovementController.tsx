"use client";

import { useEffect } from "react";
import { usePrivacyConsent } from "@/components/privacy/PrivacyConsentProvider";
import { disableProductImprovement, enableProductImprovement } from "@/lib/productImprovement";

/**
 * Bridges consent state to PostHog, one of the Product improvement technologies
 * (spec §12). GA4 and Clarity are handled by ThirdPartyAnalyticsController.
 * An accepted Product improvement choice starts PostHog; anything else stops future collection.
 * Runs on mount too, so a returning visitor who already accepted resumes
 * without re-consenting.
 */
export function ProductImprovementController() {
  const { choices, ready } = usePrivacyConsent();
  const allowed = choices.productImprovement;

  useEffect(() => {
    if (!ready) return;
    if (allowed) {
      void enableProductImprovement();
    } else {
      disableProductImprovement();
    }
  }, [allowed, ready]);

  return null;
}
