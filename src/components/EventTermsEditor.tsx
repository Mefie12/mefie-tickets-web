"use client";

import { useUnsavedRegistration } from "@/lib/useUnsaved";
import { modals } from "@mantine/modals";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dropzone, PDF_MIME_TYPE } from "@mantine/dropzone";
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Checkbox,
  Divider,
  Group,
  List,
  Loader,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconCopy, IconEye, IconFileText, IconHistory, IconInfoCircle, IconPencil, IconShieldCheck, IconUpload, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { RichTextDescription } from "@/components/RichTextDescription";
import { LegalDocumentView } from "@/components/LegalDocumentView";
import classes from "./eventTermsEditor.module.css";
import {
  copyTermsFromEvent,
  createPdfTermsVersion,
  createTermsVersion,
  discardTermsDraft,
  getEventTerms,
  getTermsCopySources,
  publishTermsVersion,
  updateTermsConfig,
  updateTermsVersion,
  type EventTermsVersion,
} from "@/lib/eventTermsApi";

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

const isBlank = (html: string) => html.replace(/<[^>]*>/g, "").trim() === "";
const pdfUrl = (eventId: number, versionId: number) => `/api/events/${eventId}/terms/versions/${versionId}/pdf`;
const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

/**
 * Terms & Conditions tab. There's no server-fetched initial data — a config row
 * doesn't exist until the first draft is created — so this fetches its own data
 * client-side and refetches after every mutation (same pattern as GateCheckIn.tsx).
 *
 * The flow is: write or upload (or copy from another event) → one Publish step that
 * shows what buyers will see and, in the same action, whether acceptance is required
 * at checkout. A published version is permanent; a draft can always be edited,
 * replaced or discarded.
 */
export function EventTermsEditor({ eventId, disabled }: { eventId: number; disabled: boolean }) {
  const router = useRouter();
  const query = useQuery({ queryKey: ["event-terms", eventId], queryFn: () => getEventTerms(eventId) });
  const sourcesQuery = useQuery({ queryKey: ["event-terms-sources", eventId], queryFn: () => getTermsCopySources(eventId), enabled: !disabled });

  // `composer` is the not-yet-saved "write" editor shown before a draft exists. `draftText` is the
  // editor's current text; null means "untouched, show what is saved".
  const [composer, setComposer] = useState<"write" | "pdf" | null>(null);
  const [draftText, setDraftText] = useState<string | null>(null);
  const [replacingWithPdf, setReplacingWithPdf] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<EventTermsVersion | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const terms = query.data?.terms ?? null;
  const versions = terms?.versions ?? [];
  const draftVersion = versions.find((version) => version.status === "DRAFT") ?? null;
  const currentVersion = terms?.current_version ?? null;
  const enabled = terms?.enabled ?? false;

  const savedText = draftVersion?.rich_text_content ?? "";
  const editorText = draftText ?? savedText;
  const draftIsRichText = draftVersion?.content_type === "RICH_TEXT";
  const draftEdited = draftIsRichText && draftText !== null && draftText !== savedText;
  const composerHasText = composer === "write" && !isBlank(draftText ?? "");

  // Typed terms that haven't been saved yet count as unsaved (leave guards, tab dot).
  useUnsavedRegistration("event-terms", "Terms & Conditions", draftEdited || composerHasText, () => setDraftText(null));

  function handleError(error: Error) {
    if (redirectOnAuthError(error, router)) return;
    notifications.show({ color: "red", message: error instanceof ApiError ? error.message : "Something went wrong." });
  }

  function resetEditing() {
    setComposer(null);
    setDraftText(null);
    setReplacingWithPdf(false);
    setPublishOpen(false);
  }

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (draftVersion) return updateTermsVersion(eventId, draftVersion.id, editorText);
      return createTermsVersion(eventId, draftText ?? "");
    },
    onSuccess: () => {
      resetEditing();
      query.refetch();
      notifications.show({ color: "teal", message: "Draft saved." });
    },
    onError: handleError,
  });

  const uploadPdfMutation = useMutation({
    mutationFn: (file: File) => createPdfTermsVersion(eventId, file, draftVersion !== null),
    onSuccess: () => {
      resetEditing();
      query.refetch();
      notifications.show({ color: "teal", message: "PDF uploaded as a draft." });
    },
    onError: handleError,
  });

  const discardMutation = useMutation({
    mutationFn: (versionId: number) => discardTermsDraft(eventId, versionId),
    onSuccess: () => {
      resetEditing();
      query.refetch();
      notifications.show({ color: "gray", message: "Draft discarded." });
    },
    onError: handleError,
  });

  const copyMutation = useMutation({
    mutationFn: (sourceEventId: number) => copyTermsFromEvent(eventId, sourceEventId),
    onSuccess: () => {
      setCopyOpen(false);
      resetEditing();
      query.refetch();
      notifications.show({ color: "teal", message: "Copied as a draft. Review it, then publish." });
    },
    onError: handleError,
  });

  const useAsDraftMutation = useMutation({
    mutationFn: (content: string) => createTermsVersion(eventId, content),
    onSuccess: () => {
      resetEditing();
      query.refetch();
    },
    onError: handleError,
  });

  const toggleEnabledMutation = useMutation({
    mutationFn: (value: boolean) => updateTermsConfig(eventId, value),
    onSuccess: () => query.refetch(),
    onError: handleError,
  });

  // Publishing saves whatever is in the editor first, so there is no separate "Save draft" step to forget.
  const publishMutation = useMutation({
    mutationFn: async (requireAcceptance: boolean) => {
      let versionId = draftVersion?.id ?? null;
      if (versionId === null) {
        versionId = (await createTermsVersion(eventId, draftText ?? "")).version.id;
      } else if (draftEdited) {
        await updateTermsVersion(eventId, versionId, editorText);
      }
      return { ...(await publishTermsVersion(eventId, versionId, requireAcceptance)), requireAcceptance };
    },
    onSuccess: ({ requireAcceptance }) => {
      resetEditing();
      query.refetch();
      notifications.show({ color: "teal", message: requireAcceptance ? "Terms published and required at checkout." : "Terms published." });
    },
    // A failed publish may still have saved the draft; show whatever is stored now.
    onError: (error) => {
      handleError(error);
      query.refetch();
    },
  });

  if (query.isLoading) {
    return (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    );
  }

  const sources = sourcesQuery.data?.sources ?? [];
  const busy = saveDraftMutation.isPending || uploadPdfMutation.isPending || discardMutation.isPending || publishMutation.isPending || copyMutation.isPending || useAsDraftMutation.isPending;
  const canPublish = draftVersion ? (draftIsRichText ? !isBlank(editorText) : true) : composer === "write" && composerHasText;

  function confirmDiscard() {
    if (!draftVersion) return;
    modals.openConfirmModal({
      title: "Discard this draft?",
      centered: true,
      children: <Text size="sm">Draft v{draftVersion.version_number} will be deleted. Published versions are not affected.</Text>,
      labels: { confirm: "Discard draft", cancel: "Keep draft" },
      confirmProps: { color: "red" },
      cancelProps: { variant: "default" },
      onConfirm: () => discardMutation.mutate(draftVersion.id),
    });
  }

  function confirmSwitchToWriting() {
    if (!draftVersion) return;
    modals.openConfirmModal({
      title: "Write your terms instead?",
      centered: true,
      children: <Text size="sm">The PDF in this draft will be removed so you can write your terms directly.</Text>,
      labels: { confirm: "Remove PDF and write", cancel: "Keep PDF" },
      cancelProps: { variant: "default" },
      onConfirm: async () => {
        await discardMutation.mutateAsync(draftVersion.id);
        setComposer("write");
      },
    });
  }

  const pdfDropzone = (replace: boolean) => (
    <Stack gap="xs">
      <Dropzone
        onDrop={(files) => files[0] && uploadPdfMutation.mutate(files[0])}
        onReject={() => notifications.show({ color: "red", message: "That file can't be used — PDF only, up to 10MB." })}
        maxSize={MAX_PDF_SIZE_BYTES}
        accept={PDF_MIME_TYPE}
        maxFiles={1}
        loading={uploadPdfMutation.isPending}
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
          <Text size="sm">Drag a PDF here, or click to browse (max 10MB)</Text>
        </Group>
      </Dropzone>
      {replace && (
        <Text size="xs" c="dimmed">
          This replaces your current draft. Published versions are not affected.
        </Text>
      )}
    </Stack>
  );

  const published = versions.filter((version) => version.status === "PUBLISHED");
  const liveAccepted = published.find((version) => version.id === currentVersion?.id)?.acceptances_count ?? 0;
  const tone = !currentVersion ? "gray" : enabled ? "teal" : "yellow";
  const visibleHistory = showAllHistory ? published : published.slice(0, 5);
  const editing = draftVersion !== null || composer !== null;
  const canEdit = !disabled;

  const viewLive = currentVersion ? (
    currentVersion.content_type === "PDF" ? (
      <Button component="a" href={pdfUrl(eventId, currentVersion.id)} target="_blank" variant="default" size="xs" leftSection={<IconFileText size={14} />}>
        View PDF
      </Button>
    ) : (
      <Button variant="default" size="xs" leftSection={<IconEye size={14} />} onClick={() => setViewingVersion(currentVersion)}>
        View terms
      </Button>
    )
  ) : null;

  const startButtons = (
    <Group gap="xs" justify="center">
      <Button
        variant={currentVersion ? "default" : "filled"}
        leftSection={<IconPencil size={16} />}
        onClick={() => {
          setDraftText(currentVersion?.content_type === "RICH_TEXT" ? (currentVersion.rich_text_content ?? "") : null);
          setComposer("write");
        }}
      >
        {currentVersion?.content_type === "RICH_TEXT" ? "Edit current terms" : "Write terms"}
      </Button>
      <Button variant="default" leftSection={<IconUpload size={16} />} onClick={() => setComposer("pdf")}>
        Upload PDF
      </Button>
      {sources.length > 0 && (
        <Button variant="subtle" leftSection={<IconCopy size={16} />} onClick={() => setCopyOpen(true)}>
          Copy from another event
        </Button>
      )}
    </Group>
  );

  return (
    <Stack gap="lg">
      {/* 1. Where things stand: what buyers experience right now. */}
      {currentVersion ? (
        <Card withBorder radius="lg" p={0} className={classes.hero} data-tone={tone}>
          <Group justify="space-between" align="flex-start" p="lg" gap="md">
            <Group gap="md" align="flex-start" wrap="nowrap" style={{ flex: "1 1 18rem", minWidth: 0 }}>
              <ThemeIcon size={44} radius="md" variant="light" color={tone}>
                <IconShieldCheck size={24} />
              </ThemeIcon>
              <Stack gap={4} style={{ minWidth: 0 }}>
                <Group gap="xs">
                  <Title order={4}>Terms &amp; Conditions</Title>
                  <Badge color={tone} variant="light">
                    {enabled ? "Required at checkout" : "Not required"}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed" maw={560}>
                  {enabled
                    ? `Buyers accept version ${currentVersion.version_number} before paying. Free-only checkouts are never asked.`
                    : "Published, but buyers aren't asked to accept it. Turn this on to require it at checkout."}
                </Text>
              </Stack>
            </Group>
            <Switch
              size="md"
              labelPosition="left"
              label="Require at checkout"
              aria-label="Require acceptance at checkout"
              checked={enabled}
              disabled={disabled || toggleEnabledMutation.isPending}
              onChange={(event) => toggleEnabledMutation.mutate(event.currentTarget.checked)}
            />
          </Group>
          <Divider />
          <SimpleGrid cols={{ base: 1, xs: 3 }} spacing={{ base: "sm", xs: "lg" }} p={{ base: "md", xs: "lg" }}>
            <Stack gap={2}>
              <Text className={classes.statLabel}>Live version</Text>
              <Group gap="xs">
                <Text fw={600}>Version {currentVersion.version_number}</Text>
                <Badge size="sm" variant="light" color="gray">
                  {currentVersion.content_type === "PDF" ? "PDF" : "Text"}
                </Badge>
              </Group>
            </Stack>
            <Stack gap={2}>
              <Text className={classes.statLabel}>Published</Text>
              <Text fw={600}>{formatDate(currentVersion.published_at)}</Text>
            </Stack>
            <Stack gap={2}>
              <Text className={classes.statLabel}>Accepted by</Text>
              <Text fw={600}>{liveAccepted === 0 ? "No orders yet" : `${liveAccepted} ${liveAccepted === 1 ? "order" : "orders"}`}</Text>
            </Stack>
          </SimpleGrid>
          <Group className={classes.actionBar} px="lg" py="sm" justify="space-between">
            {viewLive}
            <Text size="xs" c="dimmed">
              A published version is permanent. Changes are published as a new version.
            </Text>
          </Group>
        </Card>
      ) : !editing && canEdit ? (
        <Card withBorder radius="lg" p="xl" className={classes.hero} data-tone="gray">
          <Stack gap="md" align="center" py="md">
            <ThemeIcon size={52} radius="xl" variant="light" color="gray">
              <IconShieldCheck size={28} />
            </ThemeIcon>
            <Stack gap={4} align="center">
              <Title order={4}>Add your Terms &amp; Conditions</Title>
              <Text size="sm" c="dimmed" ta="center" maw={460}>
                Write your terms, upload a PDF, or start from another event. You&apos;ll review exactly what buyers see before anything goes live.
              </Text>
            </Stack>
            {startButtons}
          </Stack>
        </Card>
      ) : (
        <Alert color="gray" variant="light" icon={<IconInfoCircle size={18} />}>
          {editing ? "Not published yet. Until you publish, buyers aren't asked to accept anything." : "No Terms & Conditions were set for this event."}
        </Alert>
      )}

      {/* 2. The work in progress: a draft, or the invitation to start one. */}
      {draftVersion || composer === "write" ? (
        <Card withBorder radius="lg" p={0}>
          <Group justify="space-between" align="center" px="lg" pt="lg" pb="sm" gap="xs">
            <Group gap="xs">
              <Title order={5}>{currentVersion ? "New version" : "Your terms"}</Title>
              <Badge color="gray" variant="light">
                {draftVersion ? `Draft v${draftVersion.version_number}` : "Unsaved"}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              Not visible to buyers until you publish it.
            </Text>
          </Group>

          <Stack gap="sm" px="lg" pb="lg">
            {draftVersion && !draftIsRichText ? (
              <Stack gap="sm">
                <Group gap="sm" p="md" style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: "var(--mantine-radius-md)" }}>
                  <ThemeIcon variant="light" color="gray" size="lg" radius="md">
                    <IconFileText size={20} />
                  </ThemeIcon>
                  <Stack gap={0} style={{ flex: 1 }}>
                    <Text size="sm" fw={600}>
                      PDF uploaded
                    </Text>
                    <Text size="xs" c="dimmed">
                      Buyers open it in a new tab from the checkout.
                    </Text>
                  </Stack>
                  <Button component="a" href={pdfUrl(eventId, draftVersion.id)} target="_blank" variant="default" size="xs">
                    Preview
                  </Button>
                </Group>
                {canEdit &&
                  (replacingWithPdf ? (
                    <Stack gap="xs">
                      {pdfDropzone(true)}
                      <Button variant="subtle" size="xs" style={{ alignSelf: "flex-start" }} onClick={() => setReplacingWithPdf(false)}>
                        Keep this PDF
                      </Button>
                    </Stack>
                  ) : (
                    <Group gap="xs">
                      <Button variant="subtle" size="xs" leftSection={<IconUpload size={14} />} onClick={() => setReplacingWithPdf(true)}>
                        Replace PDF
                      </Button>
                      <Button variant="subtle" size="xs" leftSection={<IconPencil size={14} />} onClick={confirmSwitchToWriting}>
                        Write instead
                      </Button>
                    </Group>
                  ))}
              </Stack>
            ) : (
              <>
                <RichTextDescription
                  label="Terms & Conditions"
                  description="This is what buyers will be asked to accept once published."
                  required={false}
                  value={draftVersion ? editorText : (draftText ?? "")}
                  onChange={setDraftText}
                  disabled={disabled}
                />
                {canEdit &&
                  (replacingWithPdf ? (
                    <Stack gap="xs">
                      {pdfDropzone(!!draftVersion)}
                      <Button variant="subtle" size="xs" style={{ alignSelf: "flex-start" }} onClick={() => setReplacingWithPdf(false)}>
                        Keep writing instead
                      </Button>
                    </Stack>
                  ) : draftVersion ? (
                    <Button variant="subtle" size="xs" leftSection={<IconUpload size={14} />} style={{ alignSelf: "flex-start" }} onClick={() => setReplacingWithPdf(true)}>
                      Upload a PDF instead
                    </Button>
                  ) : null)}
              </>
            )}
          </Stack>

          {canEdit && (
            <Group className={classes.actionBar} px="lg" py="sm" justify="space-between">
              {draftVersion ? (
                <Button variant="subtle" color="red" disabled={busy} onClick={confirmDiscard}>
                  Discard draft
                </Button>
              ) : (
                <Button variant="subtle" color="gray" disabled={busy} onClick={resetEditing}>
                  Cancel
                </Button>
              )}
              <Group gap="xs">
                {(draftVersion ? draftIsRichText : true) && (
                  <Button
                    variant="default"
                    loading={saveDraftMutation.isPending}
                    disabled={(draftVersion ? !draftEdited || isBlank(editorText) : !composerHasText) || busy}
                    onClick={() => saveDraftMutation.mutate()}
                  >
                    Save draft
                  </Button>
                )}
                <Button disabled={!canPublish || busy} onClick={() => setPublishOpen(true)}>
                  Publish…
                </Button>
              </Group>
            </Group>
          )}
        </Card>
      ) : composer === "pdf" && canEdit ? (
        <Card withBorder radius="lg" p="lg">
          <Stack gap="sm">
            <Title order={5}>Upload your terms as a PDF</Title>
            {pdfDropzone(false)}
            <Button variant="subtle" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={resetEditing}>
              Cancel
            </Button>
          </Stack>
        </Card>
      ) : draftVersion === null && currentVersion && canEdit ? (
        <Card withBorder radius="lg" p="lg" className={classes.dashed}>
          <Group justify="space-between" align="center" gap="md">
            <Stack gap={2} style={{ flex: "1 1 16rem" }}>
              <Text fw={600}>Publish a new version</Text>
              <Text size="sm" c="dimmed">
                Update your terms any time. Buyers are asked to accept the newest version.
              </Text>
            </Stack>
            {startButtons}
          </Group>
        </Card>
      ) : null}

      {/* 3. The record: published versions, newest first. */}
      {published.length > 0 && (
        <Card withBorder radius="lg" p={0}>
          <Group justify="space-between" px="lg" py="md" style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
            <Group gap="xs">
              <IconHistory size={18} opacity={0.7} />
              <Title order={5}>Version history</Title>
            </Group>
            <Text size="xs" c="dimmed">
              {published.length} published {published.length === 1 ? "version" : "versions"}
            </Text>
          </Group>
          <Box>
            {visibleHistory.map((version) => {
              const live = version.id === currentVersion?.id;
              const accepted = version.acceptances_count ?? 0;
              return (
                <Box key={version.id} className={classes.historyRow}>
                  <Group gap={6} wrap="nowrap">
                    <Text fw={600} size="sm">
                      v{version.version_number}
                    </Text>
                    <Badge size="sm" variant={live ? "filled" : "light"} color={live ? "teal" : "gray"}>
                      {live ? "Live" : "Previous"}
                    </Badge>
                  </Group>
                  <Stack gap={0} className={classes.historyMeta} style={{ minWidth: 0 }}>
                    <Text size="sm">
                      {version.content_type === "PDF" ? "PDF document" : "Written terms"} · Published {formatDate(version.published_at)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {accepted > 0 ? `Accepted by ${accepted} ${accepted === 1 ? "order" : "orders"}` : "No orders have accepted this version"}
                    </Text>
                  </Stack>
                  <Group gap={4} wrap="nowrap">
                    {canEdit && !draftVersion && !live && version.content_type === "RICH_TEXT" && (
                      <Button size="xs" variant="subtle" disabled={busy} onClick={() => useAsDraftMutation.mutate(version.rich_text_content ?? "")}>
                        Use as new draft
                      </Button>
                    )}
                    {version.content_type === "PDF" ? (
                      <Button component="a" href={pdfUrl(eventId, version.id)} target="_blank" size="xs" variant="default">
                        View
                      </Button>
                    ) : (
                      <Button size="xs" variant="default" onClick={() => setViewingVersion(version)}>
                        View
                      </Button>
                    )}
                  </Group>
                </Box>
              );
            })}
          </Box>
          {published.length > 5 && (
            <Group justify="center" py="xs" style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
              <Button variant="subtle" size="xs" onClick={() => setShowAllHistory((open) => !open)}>
                {showAllHistory ? "Show fewer" : `Show ${published.length - 5} older ${published.length - 5 === 1 ? "version" : "versions"}`}
              </Button>
            </Group>
          )}
        </Card>
      )}

      <PublishModal
        opened={publishOpen}
        onClose={() => setPublishOpen(false)}
        versionNumber={draftVersion?.version_number ?? (versions[0]?.version_number ?? 0) + 1}
        isPdf={draftVersion ? !draftIsRichText : false}
        previewHtml={composer === "write" || draftIsRichText ? editorText || (draftText ?? "") : ""}
        previewPdfUrl={draftVersion && !draftIsRichText ? pdfUrl(eventId, draftVersion.id) : null}
        liveVersionNumber={currentVersion?.version_number ?? null}
        enabled={enabled}
        savesEdits={draftEdited || (!draftVersion && composer === "write")}
        pending={publishMutation.isPending}
        onConfirm={(requireAcceptance) => publishMutation.mutate(requireAcceptance)}
      />

      <Modal opened={copyOpen} onClose={() => setCopyOpen(false)} title="Copy terms from another event" centered>
        <CopyForm
          sources={sources}
          pending={copyMutation.isPending}
          onCancel={() => setCopyOpen(false)}
          onCopy={(sourceEventId) => copyMutation.mutate(sourceEventId)}
        />
      </Modal>

      <Modal opened={viewingVersion !== null} onClose={() => setViewingVersion(null)} title={`Version ${viewingVersion?.version_number ?? ""}`} size="lg">
        {viewingVersion && <LegalDocumentView title="Terms & Conditions" hideTitle html={viewingVersion.rich_text_content ?? ""} />}
      </Modal>
    </Stack>
  );
}

type PublishProps = {
  versionNumber: number;
  isPdf: boolean;
  previewHtml: string;
  previewPdfUrl: string | null;
  liveVersionNumber: number | null;
  enabled: boolean;
  savesEdits: boolean;
  pending: boolean;
  onConfirm: (requireAcceptance: boolean) => void;
};

function PublishModal({ opened, onClose, ...props }: PublishProps & { opened: boolean; onClose: () => void }) {
  return (
    <Modal opened={opened} onClose={props.pending ? () => {} : onClose} title={`Publish version ${props.versionNumber}?`} size="lg" centered>
      {/* Mounted only while open, so the checkbox starts from the current setting each time. */}
      {opened && <PublishBody {...props} onClose={onClose} />}
    </Modal>
  );
}

function PublishBody({ isPdf, previewHtml, previewPdfUrl, liveVersionNumber, enabled, savesEdits, pending, onConfirm, onClose }: PublishProps & { onClose: () => void }) {
  // First publish defaults to "required" (the point of publishing); later ones keep whatever is set now.
  const [require, setRequire] = useState(liveVersionNumber === null ? true : enabled);
  const replacesLive = liveVersionNumber !== null && enabled;

  return (
    <Stack gap="md">
      <Stack gap={6}>
        <Text size="sm" fw={600}>
          What buyers will see
        </Text>
        <Box style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: 8 }} p="sm">
          <Checkbox readOnly checked={false} tabIndex={-1} label="I have read and accepted this organizer's Terms & Conditions" styles={{ root: { pointerEvents: "none" } }} />
        </Box>
        {isPdf ? (
          previewPdfUrl && (
            <Button component="a" href={previewPdfUrl} target="_blank" variant="light" size="xs" leftSection={<IconFileText size={14} />} style={{ alignSelf: "flex-start" }}>
              Preview the PDF
            </Button>
          )
        ) : (
          <Box mah={220} style={{ overflow: "auto", border: "1px solid var(--mantine-color-default-border)", borderRadius: 8 }} p="sm">
            <LegalDocumentView title="Terms & Conditions" hideTitle html={previewHtml} />
          </Box>
        )}
      </Stack>

      <Alert color="yellow" variant="light" title="Before you publish">
        <List size="sm" spacing={4}>
          <List.Item>Once published, a version can&apos;t be edited or deleted. To change it later you publish a new version.</List.Item>
          {replacesLive && <List.Item>Version {liveVersionNumber} is live now. This replaces it immediately, and buyers already in checkout will be asked to accept the new version.</List.Item>}
          {savesEdits && <List.Item>Your latest edits are saved as part of this version.</List.Item>}
        </List>
      </Alert>

      <Checkbox
        checked={require}
        onChange={(event) => setRequire(event.currentTarget.checked)}
        label="Require buyers to accept this at checkout"
        description="You can change this any time from the switch at the top of the page."
      />

      <Group justify="flex-end">
        <Button variant="default" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button loading={pending} onClick={() => onConfirm(require)}>
          {require ? "Publish and require" : "Publish"}
        </Button>
      </Group>
    </Stack>
  );
}

function CopyForm({
  sources,
  pending,
  onCancel,
  onCopy,
}: {
  sources: { event_id: number; event_title: string | null; event_start_date: string | null; version_number: number; content_type: "RICH_TEXT" | "PDF" }[];
  pending: boolean;
  onCancel: () => void;
  onCopy: (sourceEventId: number) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        This creates a draft you can edit. Nothing changes for buyers until you publish it.
      </Text>
      <Select
        label="Copy from"
        placeholder="Choose an event"
        searchable
        data={sources.map((source) => ({
          value: String(source.event_id),
          label: `${source.event_title ?? "Untitled event"} — v${source.version_number}, ${source.content_type === "PDF" ? "PDF" : "text"}${source.event_start_date ? ` · ${formatDate(source.event_start_date)}` : ""}`,
        }))}
        value={selected}
        onChange={setSelected}
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button loading={pending} disabled={selected === null} onClick={() => selected && onCopy(Number(selected))}>
          Copy as draft
        </Button>
      </Group>
    </Stack>
  );
}
