"use client";

import { Fragment, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Checkbox, Text } from "@mantine/core";
import { TermsAndConditionsLink } from "@/components/TermsAndConditionsLink";
import { getLegalDocumentsForPlacement, type LegalDocumentPlacementSlug, type PublicLegalDocument } from "@/lib/legalDocumentsApi";

const listFormatter = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

const MODE_STRENGTH = { INFORMATIONAL: 0, CONTINUE_IMPLIES: 1, REQUIRED_CHECKBOX: 2 } as const;
/** The API always sends a mode; a missing one is treated as the strictest. */
const modeOf = (document: PublicLegalDocument) => document.acceptance_mode ?? "REQUIRED_CHECKBOX";

/**
 * Every published document on one or more placements, merged and de-duplicated
 * (a document attached to two of them is listed once, at its strictest mode), and
 * split by how it is agreed to: `required` needs a ticked checkbox, `implied` is
 * agreed by continuing, `informational` is only linked. `versionIds` is what a form
 * must send back so the server can verify the user was shown exactly what binds
 * them; link-only documents are not part of it.
 */
export function useLegalDocuments(placements: LegalDocumentPlacementSlug | LegalDocumentPlacementSlug[]) {
  const list = Array.isArray(placements) ? placements : [placements];
  const query = useQuery({
    queryKey: ["legal-documents", "placements", [...list].sort().join(",")],
    queryFn: async () => {
      const groups = await Promise.all(list.map((placement) => getLegalDocumentsForPlacement(placement)));
      const byVersion = new Map<number, PublicLegalDocument>();
      for (const document of groups.flat()) {
        const seen = byVersion.get(document.version_id);
        if (!seen || MODE_STRENGTH[modeOf(document)] > MODE_STRENGTH[modeOf(seen)]) byVersion.set(document.version_id, document);
      }
      return [...byVersion.values()];
    },
  });
  const documents = query.data ?? [];
  const required = documents.filter((document) => modeOf(document) === "REQUIRED_CHECKBOX");
  const implied = documents.filter((document) => modeOf(document) === "CONTINUE_IMPLIES");
  const informational = documents.filter((document) => modeOf(document) === "INFORMATIONAL");
  return {
    documents,
    required,
    implied,
    informational,
    versionIds: [...required, ...implied].map((document) => document.version_id),
    isLoading: query.isLoading,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/**
 * What a signup surface shows for the documents an admin attached, exactly as configured: a required
 * checkbox for "Required checkbox" documents and the sentence "By {action} you agree to Mefie Tickets' …"
 * for "Continuing implies agreement" ones. With nothing attached it renders nothing (no invented terms).
 * Link-only is not offered on these surfaces: whatever is attached here binds people.
 */
export function LegalAgreement({
  documents,
  action,
  checked,
  onChange,
  error,
}: {
  documents: Pick<ReturnType<typeof useLegalDocuments>, "required" | "implied">;
  action: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: ReactNode;
}) {
  const { required, implied } = documents;
  if (required.length + implied.length === 0) return null;

  return (
    <>
      {required.length > 0 && (
        <Checkbox
          checked={checked}
          onChange={(event) => onChange(event.currentTarget.checked)}
          error={error}
          label={
            <>
              I accept Mefie Tickets&rsquo; <LegalDocumentLinkList documents={required} />.
            </>
          }
        />
      )}
      {implied.length > 0 && (
        <Text size="xs" c="dimmed">
          By {action} you agree to Mefie Tickets&rsquo; <LegalDocumentLinkList documents={implied} />.
        </Text>
      )}
    </>
  );
}

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
  linkClassName,
}: {
  placement: LegalDocumentPlacementSlug | LegalDocumentPlacementSlug[];
  /** Rendered while loading or if the placement has zero published documents. `null` renders nothing at all. */
  fallback: ReactNode | null;
  /** Optional visual treatment for links at the consuming surface. */
  linkClassName?: string;
}) {
  const { documents, isLoading } = useLegalDocuments(placement);

  if (isLoading || documents.length === 0) {
    return <>{fallback}</>;
  }

  return <LegalDocumentLinkList documents={documents} linkClassName={linkClassName} />;
}

/** Presentational counterpart for consumers that already fetched a placement's documents. */
export function LegalDocumentLinkList({ documents, linkClassName }: { documents: PublicLegalDocument[]; linkClassName?: string }) {
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
            title={document.name}
            pageHref={`/legal/${document.slug}`}
            versionNumber={document.version_number}
            publishedAt={document.published_at}
            className={linkClassName}
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
export function LegalDocumentLinksLine({
  placement,
  mode,
  className,
  linkClassName,
}: {
  placement: LegalDocumentPlacementSlug;
  /** Only list documents attached with this agreement mode. */
  mode?: "REQUIRED_CHECKBOX" | "CONTINUE_IMPLIES" | "INFORMATIONAL";
  className?: string;
  linkClassName?: string;
}) {
  const query = useQuery({
    queryKey: ["legal-documents", "placement", placement],
    queryFn: () => getLegalDocumentsForPlacement(placement),
  });

  const documents = (query.data ?? []).filter((document) => !mode || document.acceptance_mode === mode);
  if (documents.length === 0) return null;

  return (
    <Text className={className}>
      This purchase is also subject to Mefie Tickets&apos; <LegalDocumentLinkList documents={documents} linkClassName={linkClassName} />.
    </Text>
  );
}

/**
 * The sentence directly above the pay button: who is the seller, and (for documents attached in
 * "continuing implies agreement" mode) what placing the order agrees to. The agreement part is
 * recorded server-side with this exact wording. If the document list cannot be loaded the sentence
 * still shows, with plain names, so checkout is never left without it.
 */
export function CheckoutAgreementNotice({
  organizerName,
  className,
  linkClassName,
}: {
  organizerName: string | null;
  className?: string;
  linkClassName?: string;
}) {
  const query = useQuery({
    queryKey: ["legal-documents", "placement", "ticket-checkout"],
    queryFn: () => getLegalDocumentsForPlacement("ticket-checkout"),
  });

  if (query.isLoading) return null;
  const agreed = (query.data ?? []).filter((document) => document.acceptance_mode === "CONTINUE_IMPLIES");
  const failed = query.isError;
  const agreement = failed || agreed.length > 0;

  return (
    <Text className={className} component="p" style={{ margin: 0 }}>
      {agreement && <>By placing this order you agree to Mefie Tickets&apos; {failed ? "Terms of Sale and Refund Policy" : <LegalDocumentLinkList documents={agreed} linkClassName={linkClassName} />}. </>}
      Mefie Tickets provides the ticketing technology; {organizerName ?? "the organizer"} is the seller and organizer of this event.
    </Text>
  );
}
