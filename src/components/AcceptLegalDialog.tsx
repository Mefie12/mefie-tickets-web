"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Accordion, Button, Checkbox, Group, Modal, Stack, Text } from "@mantine/core";
import { LegalDocumentView } from "@/components/LegalDocumentView";
import { ApiError } from "@/lib/authApi";
import { acceptOrganizerDocuments, type OrganizerLegalDocument } from "@/lib/organizationLegalApi";

/**
 * "Review and accept to continue": every organizer document the organization has never agreed to,
 * one checkbox, and a button that records the agreement and lets the blocked action carry on.
 * A non-admin sees who can accept instead of a button that cannot work.
 */
export function AcceptLegalDialog({
  opened,
  documents,
  admins,
  canAccept,
  onAccepted,
  onClose,
}: {
  opened: boolean;
  documents: OrganizerLegalDocument[];
  admins: string[];
  canAccept: boolean;
  onAccepted: () => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [agreed, setAgreed] = useState(false);
  const [changed, setChanged] = useState(false);

  const accept = useMutation({
    mutationFn: () => acceptOrganizerDocuments(documents.map((document) => document.version_id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["organization-legal"] });
      setAgreed(false);
      onAccepted();
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.code === "DOCUMENTS_CHANGED") setChanged(true);
    },
  });

  const names = documents.map((document) => document.name).join(", ");

  return (
    <Modal opened={opened} onClose={onClose} title="Review and accept to continue" size="lg">
      <Stack gap="md">
        <Text size="sm">
          Before you sell paid tickets on Mefie Tickets, {canAccept ? "please review and accept" : "your organization needs to accept"} {names}. Nothing else on your account is blocked.
        </Text>
        <Accordion variant="separated" defaultValue={documents.length === 1 ? String(documents[0].version_id) : null}>
          {documents.map((document) => (
            <Accordion.Item key={document.version_id} value={String(document.version_id)}>
              <Accordion.Control>{document.name}</Accordion.Control>
              <Accordion.Panel>
                {document.content_type === "PDF" ? (
                  <Button component="a" href={`/api/public/legal-documents/${document.slug}/pdf`} target="_blank" rel="noopener noreferrer" variant="light">Open the PDF</Button>
                ) : (
                  <LegalDocumentView title={document.name} hideTitle versionNumber={document.version_number} publishedAt={document.published_at} html={document.rich_text_content ?? ""} />
                )}
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
        {changed && <Alert color="orange">These documents were just updated. Close this window and try again to see the latest versions.</Alert>}
        {accept.isError && !changed && <Alert color="red">{accept.error.message}</Alert>}
        {canAccept ? (
          <>
            <Checkbox checked={agreed} onChange={(event) => setAgreed(event.currentTarget.checked)} label={`I accept ${names} on behalf of my organization.`} />
            <Group justify="flex-end">
              <Button variant="subtle" color="gray" onClick={onClose}>Not now</Button>
              <Button disabled={!agreed || changed} loading={accept.isPending} onClick={() => accept.mutate()}>Accept and continue</Button>
            </Group>
          </>
        ) : (
          <Alert color="blue">Only an organization administrator can accept these documents{admins.length > 0 ? `: ${admins.join(", ")}` : ""}.</Alert>
        )}
      </Stack>
    </Modal>
  );
}
