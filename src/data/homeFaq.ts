export type HomeFaqAudience = "buyer" | "organizer";

export type HomeFaqItem = {
  id: string;
  audience: HomeFaqAudience;
  question: string;
  answer: string;
};

export const homeFaqItems: readonly HomeFaqItem[] = [
  {
    id: "buyer-account",
    audience: "buyer",
    question: "Do I need an account to buy a ticket?",
    answer:
      "No. Buyers can select tickets and complete checkout directly from an event page without creating an organizer account.",
  },
  {
    id: "ticket-delivery",
    audience: "buyer",
    question: "How will I receive my tickets?",
    answer:
      "Tickets and the order confirmation are emailed after payment is confirmed. Buyers should verify their checkout email and check spam or junk folders if the message is not immediately visible.",
  },
  {
    id: "incomplete-payment",
    audience: "buyer",
    question: "What happens if my payment does not complete?",
    answer:
      "The checkout page reports the payment status. Buyers should avoid repeatedly submitting payment while confirmation is pending; a failed payment can be retried.",
  },
  {
    id: "refunds",
    audience: "buyer",
    question: "Can I cancel my order or request a refund?",
    answer:
      "Refund eligibility depends on the organizer’s event terms and policies. Buyers should review the terms on the event page and contact the organizer when assistance is required.",
  },
  {
    id: "publish-event",
    audience: "organizer",
    question: "How do I create and publish an event?",
    answer:
      "Create an organizer account, verify the email address, complete organization onboarding, and create the event from the organizer dashboard.",
  },
  {
    id: "ticket-options",
    audience: "organizer",
    question: "What ticket and pricing options can I offer?",
    answer:
      "Organizers can configure free, paid, donation, tiered, or registration-based products, together with inventory and sales availability.",
  },
  {
    id: "team-management",
    audience: "organizer",
    question: "Can my team help manage events and attendees?",
    answer:
      "Organization administrators can invite teammates with appropriate roles. The organizer portal includes attendee, order, ticket-delivery, and check-in tools.",
  },
  {
    id: "payments-payouts",
    audience: "organizer",
    question: "How do payments and payouts work?",
    answer:
      "Organizers connect their payment account before selling paid tickets. Payment-account status, earnings, and eligible transfers are visible in the organizer payments workspace and follow the platform’s configured release policy.",
  },
] as const;
