"use client";

import { useState } from "react";
import { Box, Modal, Text } from "@mantine/core";
import type { PublicEventTerms } from "@/lib/publicEventApi";

/**
 * Shared "View Terms & Conditions" trigger — used on the public event
 * page (viewing only, per §19) and inside CheckoutDetailsForm's
 * acceptance checkbox. PDF opens the stream route in a new tab; rich
 * text opens a Modal with the server-sanitized HTML (same
 * dangerouslySetInnerHTML pattern as the event description).
 */
export function TermsAndConditionsLink({
  eventId,
  terms,
  label = "View Terms & Conditions",
}: {
  eventId: number;
  terms: PublicEventTerms;
  label?: string;
}) {
  const [opened, setOpened] = useState(false);

  if (terms.content_type === "PDF") {
    return (
      <Text
        size="sm"
        component="a"
        href={`/api/public/events/${eventId}/terms/pdf`}
        target="_blank"
        rel="noopener noreferrer"
        // Stops a parent <label> (e.g. the checkout acceptance checkbox)
        // from also toggling when this link is clicked.
        onClick={(e) => e.stopPropagation()}
      >
        {label}
      </Text>
    );
  }

  return (
    <>
      <Text
        size="sm"
        component="button"
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpened(true);
        }}
        style={{ cursor: "pointer" }}
      >
        {label}
      </Text>
      <Modal opened={opened} onClose={() => setOpened(false)} title="Terms & Conditions" size="lg">
        <Box dangerouslySetInnerHTML={{ __html: terms.rich_text_content ?? "" }} />
      </Modal>
    </>
  );
}
