"use client";

import { useState, type MouseEvent } from "react";
import { Modal } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { LegalDocumentView } from "@/components/LegalDocumentView";
import classes from "./termsAndConditionsLink.module.css";

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
 * in a new tab; rich text opens a Modal with the HTML sanitised server-side (LegalDocumentSanitizer, on write and read)
 * (same dangerouslySetInnerHTML pattern as the event description).
 */
export function TermsAndConditionsLink({
  document,
  pdfUrl,
  label = "View Terms & Conditions",
  className,
  title,
  versionNumber,
  publishedAt,
  pageHref,
}: {
  document: LinkableDocument;
  pdfUrl: string;
  label?: string;
  className?: string;
  /** Modal heading; defaults to "Terms & Conditions" (organizer event terms). Platform documents pass their own name. */
  title?: string;
  versionNumber?: number | null;
  publishedAt?: string | null;
  /** Stable public page for this document. When set the trigger is a real link: plain click opens the modal, ctrl/middle-click opens the page. */
  pageHref?: string;
}) {
  const [opened, setOpened] = useState(false);
  const isMobile = useMediaQuery("(max-width: 36em)");
  const linkClass = className ? `${classes.link} ${className}` : classes.link;

  if (document.content_type === "PDF") {
    return (
      <a
        className={linkClass}
        href={pdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        // Stops a parent <label> (e.g. the checkout acceptance checkbox)
        // from also toggling when this link is clicked.
        onClick={(e) => e.stopPropagation()}
      >
        {label}
      </a>
    );
  }

  const heading = title ?? "Terms & Conditions";
  return (
    <>
      {pageHref ? (
        <a
          className={linkClass}
          href={pageHref}
          onClick={(e: MouseEvent<HTMLAnchorElement>) => {
            e.stopPropagation();
            // Let the browser handle new-tab gestures; a plain click stays in the flow (checkout, signup).
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            setOpened(true);
          }}
        >
          {label}
        </a>
      ) : (
        <button
          className={linkClass}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpened(true);
          }}
        >
          {label}
        </button>
      )}
      <Modal opened={opened} onClose={() => setOpened(false)} title={heading} size="lg" fullScreen={isMobile}>
        <LegalDocumentView title={heading} hideTitle versionNumber={versionNumber} publishedAt={publishedAt} html={document.rich_text_content ?? ""} />
      </Modal>
    </>
  );
}
