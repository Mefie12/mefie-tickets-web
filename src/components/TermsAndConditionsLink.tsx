"use client";

import { useState } from "react";
import { Box, Modal, Text } from "@mantine/core";

export type LinkableDocument = {
  content_type: "RICH_TEXT" | "PDF";
  /** null for PDF — pdfUrl is used instead. */
  rich_text_content: string | null;
};

/**
 * Shared "View Terms & Conditions" trigger — used on the public event
 * page, inside CheckoutDetailsForm's acceptance checkbox, and on the
 * organizer registration form's passive Terms of Use / Privacy Policy
 * disclosure. Generic over any RICH_TEXT|PDF document (event terms or a
 * platform-wide document) rather than hardcoding the event-terms shape —
 * callers supply the PDF stream URL directly. PDF opens the stream route
 * in a new tab; rich text opens a Modal with the server-sanitized HTML
 * (same dangerouslySetInnerHTML pattern as the event description).
 */
export function TermsAndConditionsLink({
  document,
  pdfUrl,
  label = "View Terms & Conditions",
}: {
  document: LinkableDocument;
  pdfUrl: string;
  label?: string;
}) {
  const [opened, setOpened] = useState(false);

  if (document.content_type === "PDF") {
    return (
      <Text
        size="sm"
        component="a"
        href={pdfUrl}
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
        <Box dangerouslySetInnerHTML={{ __html: document.rich_text_content ?? "" }} />
      </Modal>
    </>
  );
}
