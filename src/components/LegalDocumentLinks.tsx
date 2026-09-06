"use client";

import { Fragment, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Text } from "@mantine/core";
import { TermsAndConditionsLink } from "@/components/TermsAndConditionsLink";
import { getLegalDocumentsForPlacement, type LegalDocumentPlacementSlug } from "@/lib/legalDocumentsApi";

const listFormatter = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

/**
 * Renders every published legal document attached to a placement (e.g.
 * "Terms of Use, Privacy Policy and Refund Policy") as inline links —
 * generic over whatever an admin has attached, so a caller never
 * hardcodes document names. Used inline inside a sentence or a Checkbox
 * label; callers own their own surrounding copy.
 */
export function LegalDocumentLinks({
  placement,
  fallback,
}: {
  placement: LegalDocumentPlacementSlug;
  /** Rendered while loading or if the placement has zero published documents. `null` renders nothing at all. */
  fallback: ReactNode | null;
}) {
  const query = useQuery({
    queryKey: ["legal-documents", "placement", placement],
    queryFn: () => getLegalDocumentsForPlacement(placement),
  });

  const documents = query.data ?? [];

  if (query.isLoading || documents.length === 0) {
    return <>{fallback}</>;
  }

  const parts = listFormatter.formatToParts(documents.map((document) => document.name));

  return (
    <>
      {parts.map((part, index) => {
        if (part.type !== "element") return <Fragment key={index}>{part.value}</Fragment>;

        const document = documents.find((candidate) => candidate.name === part.value);
        if (!document) return <Fragment key={index}>{part.value}</Fragment>;

        return (
          <TermsAndConditionsLink
            key={document.slug}
            document={document}
            pdfUrl={`/api/public/legal-documents/${document.slug}/pdf`}
            label={document.name}
          />
        );
      })}
    </>
  );
}

/**
 * A one-line disclosure for a placement with no acceptance requirement
 * (e.g. checkout's Refund Policy) — renders nothing at all, not even the
 * surrounding sentence, when the placement has zero published documents.
 */
export function LegalDocumentLinksLine({ placement }: { placement: LegalDocumentPlacementSlug }) {
  const query = useQuery({
    queryKey: ["legal-documents", "placement", placement],
    queryFn: () => getLegalDocumentsForPlacement(placement),
  });

  if (!query.data || query.data.length === 0) return null;

  return (
    <Text size="xs" c="dimmed">
      This purchase is also subject to our <LegalDocumentLinks placement={placement} fallback={null} />.
    </Text>
  );
}
