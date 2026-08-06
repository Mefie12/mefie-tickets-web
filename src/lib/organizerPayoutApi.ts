/**
 * Types matching GET /api/organizers/{id}/payouts (ListPayoutsAction).
 * Read-only for now — fetched server-side directly via backendRequest
 * in the organizer detail page, no client Route Handler needed since
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
  history: OrganizerPayoutRelease[];
};
