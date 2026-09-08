import * as Sentry from "@sentry/nextjs";
import { readPrivacyConsentCookie } from "@/lib/privacyConsent";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  // Error capture is always on (Necessary). Performance tracing is
  // Product improvement — sampled only once the visitor has chosen
  // "Accept all". Evaluated per transaction, so a later opt-in/out takes
  // effect without a page reload.
  tracesSampler: () => (readPrivacyConsentCookie() ? 0.1 : 0),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
