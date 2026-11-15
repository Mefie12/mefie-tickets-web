"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dropzone, PDF_MIME_TYPE } from "@mantine/dropzone";
import { Alert, Badge, Button, Card, Center, Checkbox, Group, Loader, Modal, NumberInput, Select, Stack, Switch, Text, Textarea, TextInput, Title } from "@mantine/core";
import { IconFileText, IconPencil, IconUpload, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { RichTextDescription } from "@/components/RichTextDescription";
import { LegalDocumentView } from "@/components/LegalDocumentView";
import {
  createPdfLegalDocumentVersion,
  createLegalDocumentVersion,
  getLegalDocument,
  publishLegalDocumentVersion,
  updateLegalDocumentPlacements,
  updateLegalDocumentVersion,
  type LegalAcceptanceMode,
  updateLegalDocumentDetails,
  type PublishOptions,
  type LegalDocumentPlacementSlugUpper,
  type LegalDocumentVersion,
} from "@/lib/legalDocumentsAdminApi";

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

const STATUS_COLOR: Record<string, string> = { DRAFT: "gray", PUBLISHED: "teal" };

const PLACEMENT_OPTIONS: { value: LegalDocumentPlacementSlugUpper; label: string; defaultMode: LegalAcceptanceMode }[] = [
  { value: "PUBLIC_FOOTER", label: "Public footer (Legal links, readable by anyone)", defaultMode: "INFORMATIONAL" },
  { value: "ACCOUNT_REGISTRATION", label: "Account registration", defaultMode: "REQUIRED_CHECKBOX" },
  { value: "ORGANIZER_ONBOARDING", label: "Organizer onboarding (signup and team invitations)", defaultMode: "REQUIRED_CHECKBOX" },
  { value: "PAYOUT_SETUP", label: "Payouts and paid events (organizer)", defaultMode: "REQUIRED_CHECKBOX" },
  { value: "TICKET_CHECKOUT", label: "Ticket checkout", defaultMode: "INFORMATIONAL" },
  { value: "PRIVACY_CENTER", label: "Privacy centre (cookie banner)", defaultMode: "INFORMATIONAL" },
];

/** Plain-language result of each agreement mode, shown under the choice so an admin knows what people will see. */
function modeEffect(mode: LegalAcceptanceMode, name: string): string {
  switch (mode) {
    case "REQUIRED_CHECKBOX":
      return `People must tick a checkbox, "I accept ${name}", before they can continue.`;
    case "CONTINUE_IMPLIES":
      return `The screen says "By creating an account you agree to Mefie Tickets' ${name}" (the wording fits the screen). Continuing counts as agreeing, and it is recorded.`;
    default:
      return "Shown as a link to read. Nobody is asked to agree and nothing is recorded.";
  }
}

/** Where a document may be merely linked. Elsewhere (signup, invitations, payouts) whatever is attached binds people. */
const LINK_ONLY_PLACEMENTS: LegalDocumentPlacementSlugUpper[] = ["PUBLIC_FOOTER", "TICKET_CHECKOUT", "PRIVACY_CENTER"];

const MODE_OPTIONS: { value: LegalAcceptanceMode; label: string }[] = [
  { value: "REQUIRED_CHECKBOX", label: "Required checkbox" },
  { value: "CONTINUE_IMPLIES", label: "Continuing implies agreement" },
  { value: "INFORMATIONAL", label: "Link only (no agreement)" },
];

type PlacementRow = { checked: boolean; sortOrder: number; mode: LegalAcceptanceMode };
type PlacementState = Record<LegalDocumentPlacementSlugUpper, PlacementRow>;

const emptyPlacementState = (): PlacementState =>
  Object.fromEntries(PLACEMENT_OPTIONS.map((option) => [option.value, { checked: false, sortOrder: 0, mode: option.defaultMode }])) as PlacementState;

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
  const [publishing, setPublishing] = useState(false);
  const [material, setMaterial] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsName, setDetailsName] = useState("");
  const [detailsDescription, setDetailsDescription] = useState("");

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
      const stored = row.acceptance_mode ?? next[row.placement].mode;
      next[row.placement] = { checked: true, sortOrder: row.sort_order, mode: stored === "INFORMATIONAL" && !LINK_ONLY_PLACEMENTS.includes(row.placement) ? "CONTINUE_IMPLIES" : stored };
    }
    // A brand-new document is listed in the public footer unless the admin unticks it.
    if ((document.placements ?? []).length === 0 && !document.current_version) next.PUBLIC_FOOTER.checked = true;
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
    mutationFn: ({ versionId, options }: { versionId: number; options: PublishOptions }) => publishLegalDocumentVersion(slug, versionId, options),
    onSuccess: () => {
      setPublishing(false);
      query.refetch();
      notifications.show({ color: "teal", message: `${document?.name} published.` });
    },
    onError: handleError,
  });

  const detailsMutation = useMutation({
    mutationFn: () => updateLegalDocumentDetails(slug, { name: detailsName.trim(), description: detailsDescription.trim() || null }),
    onSuccess: () => {
      setEditingDetails(false);
      query.refetch();
      notifications.show({ color: "teal", message: "Document details saved." });
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
          acceptance_mode: placements[option.value].mode,
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
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4}>
          <Title order={4}>{document.name}</Title>
          <Text size="sm" c="dimmed">
            {document.description || "No internal description. Add one so other admins know what this document is for."}
          </Text>
        </Stack>
        <Button
          variant="default"
          size="xs"
          leftSection={<IconPencil size={14} />}
          onClick={() => {
            setDetailsName(document.name);
            setDetailsDescription(document.description ?? "");
            setEditingDetails(true);
          }}
        >
          Edit details
        </Button>
      </Group>

      <Modal opened={editingDetails} onClose={() => setEditingDetails(false)} title="Edit document details">
        <Stack>
          <TextInput
            label="Name"
            description="Shown to the public wherever this document is linked (footer, signup, checkout). Past acceptances are not affected."
            required
            maxLength={150}
            value={detailsName}
            onChange={(event) => setDetailsName(event.currentTarget.value)}
          />
          <Textarea
            label="Internal description"
            description="Only admins see this. Say what the document is for, for example who accepts it."
            autosize
            minRows={2}
            maxLength={1000}
            value={detailsDescription}
            onChange={(event) => setDetailsDescription(event.currentTarget.value)}
          />
          <Text size="xs" c="dimmed">
            The web address (/legal/{document.slug}) does not change, so links that are already out there keep working.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEditingDetails(false)}>
              Cancel
            </Button>
            <Button loading={detailsMutation.isPending} disabled={!detailsName.trim()} onClick={() => detailsMutation.mutate()}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

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
              <Button onClick={() => setPublishing(true)}>
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
                  <Select
                    label="Agreement"
                    size="xs"
                    w={220}
                    allowDeselect={false}
                    data={LINK_ONLY_PLACEMENTS.includes(option.value) ? MODE_OPTIONS : MODE_OPTIONS.filter((mode) => mode.value !== "INFORMATIONAL")}
                    value={placements[option.value].mode}
                    onChange={(value) =>
                      value && setPlacements((prev) => ({ ...prev, [option.value]: { ...prev[option.value], mode: value as LegalAcceptanceMode } }))
                    }
                  />
                )}
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
              {placements[option.value].checked && (
                <Text size="xs" c="dimmed">
                  {option.value === "PUBLIC_FOOTER" || option.value === "PRIVACY_CENTER" ? "Listed as a link to read." : modeEffect(placements[option.value].mode, document.name)}
                </Text>
              )}
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

      <Modal opened={publishing} onClose={() => setPublishing(false)} title={`Publish ${document.name}`} size="md">
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Publishing makes this the version everyone sees. It can&apos;t be edited afterwards; you&apos;d publish a new version instead.
          </Text>
          <Switch
            checked={material}
            onChange={(event) => setMaterial(event.currentTarget.checked)}
            label="This is a material change"
            description="Turn on for changes that affect fees, payouts, liability or what organizers agree to. Every organization admin is emailed. Leave off for typos and formatting."
          />
          {material && (
            <>
              <TextInput type="date" label="Applies from" description="Leave empty to apply from today. Use at least 30 days ahead for changes to fees or payouts." value={effectiveDate} onChange={(event) => setEffectiveDate(event.currentTarget.value)} />
              <Textarea label="What changed" description="Plain language, shown in the email and on the dashboard." maxLength={2000} autosize minRows={3} value={changeSummary} onChange={(event) => setChangeSummary(event.currentTarget.value)} />
              <Alert color="yellow" py={6}>Organization admins are emailed as soon as you publish. You can&apos;t unsend it.</Alert>
            </>
          )}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setPublishing(false)}>Cancel</Button>
            <Button
              loading={publishMutation.isPending}
              disabled={material && changeSummary.trim().length === 0}
              onClick={() =>
                draftVersion &&
                publishMutation.mutate({
                  versionId: draftVersion.id,
                  options: material
                    ? { is_material: true, effective_at: effectiveDate ? new Date(`${effectiveDate}T00:00:00`).toISOString() : null, change_summary: changeSummary.trim() }
                    : {},
                })
              }
            >
              Publish
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={viewingVersion !== null} onClose={() => setViewingVersion(null)} title={`Version ${viewingVersion?.version_number ?? ""}`} size="lg">
        {viewingVersion && (
          <LegalDocumentView title={document.name} hideTitle versionNumber={viewingVersion.version_number} publishedAt={viewingVersion.published_at} html={viewingVersion.rich_text_content ?? ""} />
        )}
      </Modal>
    </Stack>
  );
}
