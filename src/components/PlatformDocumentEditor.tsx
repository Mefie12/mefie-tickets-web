"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dropzone, PDF_MIME_TYPE } from "@mantine/dropzone";
import { Badge, Box, Button, Card, Center, Group, Loader, Modal, Stack, Text, Title } from "@mantine/core";
import { IconFileText, IconUpload, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { RichTextDescription } from "@/components/RichTextDescription";
import {
  createPdfPlatformDocumentVersion,
  createPlatformDocumentVersion,
  getPlatformDocument,
  publishPlatformDocumentVersion,
  updatePlatformDocumentVersion,
  type PlatformDocumentVersion,
} from "@/lib/platformDocumentsAdminApi";
import type { PlatformDocumentTypeSlug } from "@/lib/platformDocumentsApi";

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

const STATUS_COLOR: Record<string, string> = { DRAFT: "gray", PUBLISHED: "teal" };

/**
 * One Terms of Use / Privacy Policy document's editor. Mirrors
 * EventTermsEditor's draft/publish/version-history flow, minus the
 * per-event "require acceptance" toggle — a platform document is either
 * published (and shown at signup) or it isn't, there's no separate
 * opt-in switch.
 */
export function PlatformDocumentEditor({ type, title, disabled }: { type: PlatformDocumentTypeSlug; title: string; disabled: boolean }) {
  const router = useRouter();
  const query = useQuery({ queryKey: ["platform-document", type], queryFn: () => getPlatformDocument(type) });

  const [creating, setCreating] = useState<"write" | "pdf" | null>(null);
  const [draftText, setDraftText] = useState("");
  const [viewingVersion, setViewingVersion] = useState<PlatformDocumentVersion | null>(null);

  const document = query.data?.document ?? null;
  const versions = document?.versions ?? [];
  const latestVersion = versions[0] ?? null;
  const draftVersion = latestVersion?.status === "DRAFT" ? latestVersion : null;
  const currentVersion = document?.current_version ?? null;

  function handleError(error: Error) {
    if (redirectOnAuthError(error, router)) return;
    notifications.show({ color: "red", message: error instanceof ApiError ? error.message : "Something went wrong." });
  }

  function resetCreating() {
    setCreating(null);
    setDraftText("");
  }

  const createVersionMutation = useMutation({
    mutationFn: (content: string) => createPlatformDocumentVersion(type, content),
    onSuccess: () => {
      resetCreating();
      query.refetch();
      notifications.show({ color: "teal", message: "Draft saved." });
    },
    onError: handleError,
  });

  const createPdfMutation = useMutation({
    mutationFn: (file: File) => createPdfPlatformDocumentVersion(type, file),
    onSuccess: () => {
      resetCreating();
      query.refetch();
      notifications.show({ color: "teal", message: "PDF uploaded as a new draft." });
    },
    onError: handleError,
  });

  const updateVersionMutation = useMutation({
    mutationFn: ({ versionId, content }: { versionId: number; content: string }) =>
      updatePlatformDocumentVersion(type, versionId, content),
    onSuccess: () => {
      query.refetch();
      notifications.show({ color: "teal", message: "Draft updated." });
    },
    onError: handleError,
  });

  const publishMutation = useMutation({
    mutationFn: (versionId: number) => publishPlatformDocumentVersion(type, versionId),
    onSuccess: () => {
      query.refetch();
      notifications.show({ color: "teal", message: `${title} published.` });
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

  return (
    <Stack gap="md">
      <Title order={4}>{title}</Title>

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
                href={`/api/admin/platform-documents/${type}/versions/${currentVersion.id}/pdf`}
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
                label={title}
                description="This is what will show to organizers signing up once published."
                required={false}
                value={draftText || draftVersion.rich_text_content || ""}
                onChange={setDraftText}
                disabled={disabled}
              />
            ) : (
              <Button
                component="a"
                href={`/api/admin/platform-documents/${type}/versions/${draftVersion.id}/pdf`}
                target="_blank"
                variant="light"
                leftSection={<IconFileText size={16} />}
                style={{ alignSelf: "flex-start" }}
              >
                Preview uploaded PDF
              </Button>
            )}

            {!disabled && (
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
            )}
          </Stack>
        </Card>
      ) : (
        !disabled &&
        (creating === "write" ? (
          <Card withBorder radius="lg" p="lg">
            <Stack gap="sm">
              <RichTextDescription
                label={title}
                description="This is what will show to organizers signing up once published."
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
              <Text fw={600}>{currentVersion ? "Start a new draft" : `No ${title} yet`}</Text>
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
        ))
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
                    href={`/api/admin/platform-documents/${type}/versions/${version.id}/pdf`}
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

      <Modal opened={viewingVersion !== null} onClose={() => setViewingVersion(null)} title={`Version ${viewingVersion?.version_number ?? ""}`} size="lg">
        {viewingVersion && <Box dangerouslySetInnerHTML={{ __html: viewingVersion.rich_text_content ?? "" }} />}
      </Modal>
    </Stack>
  );
}
