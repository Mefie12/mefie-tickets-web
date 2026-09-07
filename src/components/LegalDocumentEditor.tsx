"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dropzone, PDF_MIME_TYPE } from "@mantine/dropzone";
import { Alert, Badge, Box, Button, Card, Center, Checkbox, Group, Loader, Modal, NumberInput, Stack, Text, Title } from "@mantine/core";
import { IconFileText, IconUpload, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { RichTextDescription } from "@/components/RichTextDescription";
import {
  createPdfLegalDocumentVersion,
  createLegalDocumentVersion,
  getLegalDocument,
  publishLegalDocumentVersion,
  updateLegalDocumentPlacements,
  updateLegalDocumentVersion,
  type LegalDocumentPlacementSlugUpper,
  type LegalDocumentVersion,
} from "@/lib/legalDocumentsAdminApi";

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

const STATUS_COLOR: Record<string, string> = { DRAFT: "gray", PUBLISHED: "teal" };

const PLACEMENT_OPTIONS: { value: LegalDocumentPlacementSlugUpper; label: string }[] = [
  { value: "ACCOUNT_REGISTRATION", label: "Account registration" },
  { value: "TICKET_CHECKOUT", label: "Ticket checkout" },
];

type PlacementRow = { checked: boolean; sortOrder: number };
type PlacementState = Record<LegalDocumentPlacementSlugUpper, PlacementRow>;

const emptyPlacementState = (): PlacementState => ({
  ACCOUNT_REGISTRATION: { checked: false, sortOrder: 0 },
  TICKET_CHECKOUT: { checked: false, sortOrder: 0 },
});

/**
 * One legal document's editor: draft/publish/version-history (mirrors
 * EventTermsEditor's flow, minus the per-event "require acceptance"
 * toggle — a legal document is either published or it isn't) plus which
 * placements it's attached to.
 */
export function LegalDocumentEditor({ slug }: { slug: string }) {
  const router = useRouter();
  const query = useQuery({ queryKey: ["legal-document", slug], queryFn: () => getLegalDocument(slug) });

  const [creating, setCreating] = useState<"write" | "pdf" | null>(null);
  const [draftText, setDraftText] = useState("");
  const [viewingVersion, setViewingVersion] = useState<LegalDocumentVersion | null>(null);
  const [placements, setPlacements] = useState<PlacementState>(emptyPlacementState());
  const [placementsLoadedForId, setPlacementsLoadedForId] = useState<number | null>(null);

  const document = query.data?.document ?? null;
  const versions = document?.versions ?? [];
  const latestVersion = versions[0] ?? null;
  const draftVersion = latestVersion?.status === "DRAFT" ? latestVersion : null;
  const currentVersion = document?.current_version ?? null;
  const hasPublishedVersion = currentVersion !== null;

  // Seed local placement edits from the server once per load (and again
  // after a save, since that changes document.id's placements) — the
  // React-recommended way to derive state from a prop/query result
  // without a separate effect: a guarded setState call during render.
  if (document && document.id !== placementsLoadedForId) {
    setPlacementsLoadedForId(document.id);
    const next = emptyPlacementState();
    for (const row of document.placements ?? []) {
      next[row.placement] = { checked: true, sortOrder: row.sort_order };
    }
    setPlacements(next);
  }

  function handleError(error: Error) {
    if (redirectOnAuthError(error, router)) return;
    notifications.show({ color: "red", message: error instanceof ApiError ? error.message : "Something went wrong." });
  }

  function resetCreating() {
    setCreating(null);
    setDraftText("");
  }

  const createVersionMutation = useMutation({
    mutationFn: (content: string) => createLegalDocumentVersion(slug, content),
    onSuccess: () => {
      resetCreating();
      query.refetch();
      notifications.show({ color: "teal", message: "Draft saved." });
    },
    onError: handleError,
  });

  const createPdfMutation = useMutation({
    mutationFn: (file: File) => createPdfLegalDocumentVersion(slug, file),
    onSuccess: () => {
      resetCreating();
      query.refetch();
      notifications.show({ color: "teal", message: "PDF uploaded as a new draft." });
    },
    onError: handleError,
  });

  const updateVersionMutation = useMutation({
    mutationFn: ({ versionId, content }: { versionId: number; content: string }) =>
      updateLegalDocumentVersion(slug, versionId, content),
    onSuccess: () => {
      query.refetch();
      notifications.show({ color: "teal", message: "Draft updated." });
    },
    onError: handleError,
  });

  const publishMutation = useMutation({
    mutationFn: (versionId: number) => publishLegalDocumentVersion(slug, versionId),
    onSuccess: () => {
      query.refetch();
      notifications.show({ color: "teal", message: `${document?.name} published.` });
    },
    onError: handleError,
  });

  const placementsMutation = useMutation({
    mutationFn: () =>
      updateLegalDocumentPlacements(
        slug,
        PLACEMENT_OPTIONS.filter((option) => placements[option.value].checked).map((option) => ({
          placement: option.value,
          sort_order: placements[option.value].sortOrder,
        })),
      ),
    onSuccess: () => {
      query.refetch();
      notifications.show({ color: "teal", message: "Placements updated." });
    },
    onError: handleError,
  });

  if (query.isLoading) {
    return (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    );
  }

  if (!document) {
    return <Text c="dimmed">Document not found.</Text>;
  }

  return (
    <Stack gap="md">
      <Title order={4}>{document.name}</Title>
      {document.description && (
        <Text size="sm" c="dimmed">
          {document.description}
        </Text>
      )}

      {currentVersion && (
        <Card withBorder radius="lg" p="lg">
          <Stack gap="sm">
            <Group justify="space-between">
              <Group gap="xs">
                <Text fw={600}>Current published version</Text>
                <Badge color={STATUS_COLOR[currentVersion.status]}>v{currentVersion.version_number}</Badge>
              </Group>
              <Text size="xs" c="dimmed">
                Published {currentVersion.published_at ? new Date(currentVersion.published_at).toLocaleString() : "—"}
              </Text>
            </Group>
            {currentVersion.content_type === "PDF" ? (
              <Button
                component="a"
                href={`/api/admin/platform-documents/${slug}/versions/${currentVersion.id}/pdf`}
                target="_blank"
                variant="light"
                leftSection={<IconFileText size={16} />}
                style={{ alignSelf: "flex-start" }}
              >
                View PDF
              </Button>
            ) : (
              <Button variant="light" style={{ alignSelf: "flex-start" }} onClick={() => setViewingVersion(currentVersion)}>
                View content
              </Button>
            )}
          </Stack>
        </Card>
      )}

      {draftVersion ? (
        <Card withBorder radius="lg" p="lg">
          <Stack gap="sm">
            <Group justify="space-between">
              <Group gap="xs">
                <Text fw={600}>Draft</Text>
                <Badge color={STATUS_COLOR.DRAFT}>v{draftVersion.version_number}</Badge>
              </Group>
            </Group>

            {draftVersion.content_type === "RICH_TEXT" ? (
              <RichTextDescription
                label={document.name}
                description="This is what will show wherever this document is attached, once published."
                required={false}
                value={draftText || draftVersion.rich_text_content || ""}
                onChange={setDraftText}
              />
            ) : (
              <Button
                component="a"
                href={`/api/admin/platform-documents/${slug}/versions/${draftVersion.id}/pdf`}
                target="_blank"
                variant="light"
                leftSection={<IconFileText size={16} />}
                style={{ alignSelf: "flex-start" }}
              >
                Preview uploaded PDF
              </Button>
            )}

            <Group>
              {draftVersion.content_type === "RICH_TEXT" && (
                <Button
                  variant="default"
                  loading={updateVersionMutation.isPending}
                  disabled={!draftText || draftText === draftVersion.rich_text_content}
                  onClick={() => updateVersionMutation.mutate({ versionId: draftVersion.id, content: draftText })}
                >
                  Save draft
                </Button>
              )}
              <Button loading={publishMutation.isPending} onClick={() => publishMutation.mutate(draftVersion.id)}>
                Publish
              </Button>
            </Group>
          </Stack>
        </Card>
      ) : creating === "write" ? (
        <Card withBorder radius="lg" p="lg">
          <Stack gap="sm">
            <RichTextDescription
              label={document.name}
              description="This is what will show wherever this document is attached, once published."
              required={false}
              value={draftText}
              onChange={setDraftText}
            />
            <Group>
              <Button variant="default" onClick={resetCreating}>
                Cancel
              </Button>
              <Button
                loading={createVersionMutation.isPending}
                disabled={!draftText.trim()}
                onClick={() => createVersionMutation.mutate(draftText)}
              >
                Save draft
              </Button>
            </Group>
          </Stack>
        </Card>
      ) : creating === "pdf" ? (
        <Card withBorder radius="lg" p="lg">
          <Stack gap="sm">
            <Dropzone
              onDrop={(files) => files[0] && createPdfMutation.mutate(files[0])}
              onReject={() => notifications.show({ color: "red", message: "That file can't be used — PDF only, up to 10MB." })}
              maxSize={MAX_PDF_SIZE_BYTES}
              accept={PDF_MIME_TYPE}
              maxFiles={1}
              loading={createPdfMutation.isPending}
            >
              <Group justify="center" gap="xl" mih={100} style={{ pointerEvents: "none" }}>
                <Dropzone.Accept>
                  <IconUpload size={28} />
                </Dropzone.Accept>
                <Dropzone.Reject>
                  <IconX size={28} />
                </Dropzone.Reject>
                <Dropzone.Idle>
                  <IconFileText size={28} opacity={0.5} />
                </Dropzone.Idle>
                <Text size="sm">Drag a PDF here, or click to browse</Text>
              </Group>
            </Dropzone>
            <Button variant="default" style={{ alignSelf: "flex-start" }} onClick={resetCreating}>
              Cancel
            </Button>
          </Stack>
        </Card>
      ) : (
        <Card withBorder radius="lg" p="lg">
          <Stack gap="sm" align="center" py="md">
            <Text fw={600}>{currentVersion ? "Start a new draft" : "No content yet"}</Text>
            <Text size="sm" c="dimmed" ta="center" maw={420}>
              Write rich-text content directly, or upload a PDF. Once published, a version is permanent — editing
              always creates a new draft rather than changing what&apos;s already live.
            </Text>
            <Group>
              <Button
                variant="light"
                onClick={() => {
                  setDraftText(currentVersion?.content_type === "RICH_TEXT" ? currentVersion.rich_text_content ?? "" : "");
                  setCreating("write");
                }}
              >
                Write content
              </Button>
              <Button variant="light" onClick={() => setCreating("pdf")}>
                Upload PDF
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {versions.length > 0 && (
        <Stack gap="xs">
          <Title order={6}>Version history</Title>
          <Stack gap={4}>
            {versions.map((version) => (
              <Group key={version.id} justify="space-between" py={4}>
                <Group gap="xs">
                  <Badge size="sm" color={STATUS_COLOR[version.status]}>
                    v{version.version_number}
                  </Badge>
                  <Text size="sm">{version.content_type === "PDF" ? "PDF" : "Rich text"}</Text>
                  {version.published_at && (
                    <Text size="xs" c="dimmed">
                      Published {new Date(version.published_at).toLocaleDateString()}
                    </Text>
                  )}
                </Group>
                {version.content_type === "PDF" ? (
                  <Button
                    component="a"
                    href={`/api/admin/platform-documents/${slug}/versions/${version.id}/pdf`}
                    target="_blank"
                    size="xs"
                    variant="subtle"
                  >
                    View
                  </Button>
                ) : (
                  <Button size="xs" variant="subtle" onClick={() => setViewingVersion(version)}>
                    View
                  </Button>
                )}
              </Group>
            ))}
          </Stack>
        </Stack>
      )}

      <Card withBorder radius="lg" p="lg">
        <Stack gap="sm">
          <Title order={6}>Used on</Title>
          <Text size="sm" c="dimmed">
            Where this document appears. Attaching it here doesn&apos;t require a published version — but it won&apos;t
            show publicly until one exists.
          </Text>
          {PLACEMENT_OPTIONS.map((option) => (
            <Stack key={option.value} gap={4}>
              <Group>
                <Checkbox
                  label={option.label}
                  checked={placements[option.value].checked}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    setPlacements((prev) => ({
                      ...prev,
                      [option.value]: { ...prev[option.value], checked },
                    }));
                  }}
                />
                {placements[option.value].checked && (
                  <NumberInput
                    label="Order"
                    size="xs"
                    w={80}
                    min={0}
                    value={placements[option.value].sortOrder}
                    onChange={(value) =>
                      setPlacements((prev) => ({
                        ...prev,
                        [option.value]: { ...prev[option.value], sortOrder: typeof value === "number" ? value : 0 },
                      }))
                    }
                  />
                )}
              </Group>
              {placements[option.value].checked && !hasPublishedVersion && (
                <Alert color="yellow" py={4} px="sm">
                  This document is assigned to {option.label.toLowerCase()} but has no published version. It will not
                  appear publicly until a version is published.
                </Alert>
              )}
            </Stack>
          ))}
          <Button
            variant="light"
            style={{ alignSelf: "flex-start" }}
            loading={placementsMutation.isPending}
            onClick={() => placementsMutation.mutate()}
          >
            Save placements
          </Button>
        </Stack>
      </Card>

      <Modal opened={viewingVersion !== null} onClose={() => setViewingVersion(null)} title={`Version ${viewingVersion?.version_number ?? ""}`} size="lg">
        {viewingVersion && <Box dangerouslySetInnerHTML={{ __html: viewingVersion.rich_text_content ?? "" }} />}
      </Modal>
    </Stack>
  );
}
