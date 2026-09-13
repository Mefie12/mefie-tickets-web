/**
 * Maps a publish-blocking error code (see EventService::updateStatus() and
 * EventPaymentBindingService::bindForPaidSales() on the backend, both of
 * which now throw ApiException with one of these codes for every
 * organizer-fixable gate) to what the "Publish event" confirmation button
 * should say and do instead of just resubmitting the same failing request.
 *
 * Deliberately not exhaustive: EVENT_MUST_UNARCHIVE_FIRST is unreachable
 * through the UI (the status SegmentedControl already disables "Live"
 * while archived), and ORGANIZATION_SUSPENDED / EVENT_PAYMENT_ACCOUNT_LOCKED
 * have no in-app fix — those fall back to the plain error Alert with the
 * button unchanged.
 */
export type PublishBlockerAction =
  | { type: "tab"; tab: string; label: string }
  | { type: "link"; href: string; label: string }
  | { type: "fix-currency"; label: string };

export const PUBLISH_BLOCKERS: Record<string, PublishBlockerAction> = {
  EVENT_CATEGORY_REQUIRED: { type: "tab", tab: "details", label: "Select a category" },
  EVENT_NO_PRODUCTS: { type: "tab", tab: "ticket-setup", label: "Add a product" },
  EVENT_NO_COVER_IMAGE: { type: "tab", tab: "media", label: "Add a cover image" },
  EVENT_LOCATION_INCOMPLETE: { type: "tab", tab: "location", label: "Complete location" },
  PAYMENT_SETUP_REQUIRED: { type: "link", href: "/organization/payments", label: "Set up payments" },
  EVENT_CURRENCY_MISMATCH_WITH_PAYMENT_ACCOUNT: { type: "fix-currency", label: "Update currency & publish" },
};
