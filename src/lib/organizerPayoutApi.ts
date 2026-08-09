/**
 * Types matching GET /api/organizations/{id}/payouts (ListPayoutsAction).
 * Read-only for now — fetched server-side directly via backendRequest
 * in the organization page, no client Route Handler needed since
 * there's no release-recording UI in this pass (that stays an
 * ops/SUPERADMIN API-only capability — see
 * docs/09_mvp_development_plan.md Milestone 6).
 */

export type OrganizerPayoutRelease = {
  id: number;
  amount: string;
  note: string | null;
  released_by: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  created_at: string;
};

export type OrganizerPayoutSummary = {
  collected: string;
  released: string;
  balance: string;
  /** ISO 4217 code — one currency per organizer for MVP, see EventService::resolveCurrencyCode. */
  currency: string;
  history: OrganizerPayoutRelease[];
};
