import * as Sentry from "@sentry/nextjs";

// No-op until NEXT_PUBLIC_SENTRY_DSN is set (see .env.example) — wiring
// this in now satisfies NFR-6.1 groundwork per 09_mvp_development_plan.md
// Milestone 0, without requiring a Sentry project to exist yet.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
});
