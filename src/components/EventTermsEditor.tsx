"use client";

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
  Group,
  Loader,
  Modal,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { IconFileText, IconUpload, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { RichTextDescription } from "@/components/RichTextDescription";
import {
  createPdfTermsVersion,
  createTermsVersion,
  getEventTerms,
  publishTermsVersion,
  updateTermsConfig,
  updateTermsVersion,
  type EventTermsVersion,
} from "@/lib/eventTermsApi";

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

const STATUS_COLOR: Record<string, string> = { DRAFT: "gray", PUBLISHED: "teal" };

/**
 * Terms & Conditions tab. Unlike Media/Questions, there's no
 * server-fetched initial data — a config row doesn't exist until the
 * first draft is created — so this fetches its own data client-side
 * and refetches after every mutation (same pattern as GateCheckIn.tsx)
 * rather than reconciling response shapes locally.
 */
export function EventTermsEditor({ eventId, disabled }: { eventId: number; disabled: boolean }) {
  const router = useRouter();
  const query = useQuery({ queryKey: ["event-terms", eventId], queryFn: () => getEventTerms(eventId) });

  const [creating, setCreating] = useState<"write" | "pdf" | null>(null);
  const [draftText, setDraftText] = useState("");
  const [viewingVersion, setViewingVersion] = useState<EventTermsVersion | null>(null);

  const terms = query.data?.terms ?? null;
  const versions = terms?.versions ?? [];
  const latestVersion = versions[0] ?? null;
  const draftVersion = latestVersion?.status === "DRAFT" ? latestVersion : null;
  const currentVersion = terms?.current_version ?? null;

  function handleError(error: Error) {
    if (redirectOnAuthError(error, router)) return;
    notifications.show({ color: "red", message: error instanceof ApiError ? error.message : "Something went wrong." });
  }

  function resetCreating() {
    setCreating(null);
    setDraftText("");
  }

  const createVersionMutation = useMutation({
    mutationFn: (content: string) => createTermsVersion(eventId, content),
    onSuccess: () => {
      resetCreating();
      query.refetch();
      notifications.show({ color: "teal", message: "Draft saved." });
    },
    onError: handleError,
  });

  const createPdfMutation = useMutation({
    mutationFn: (file: File) => createPdfTermsVersion(eventId, file),
    onSuccess: () => {
      resetCreating();
      query.refetch();
      notifications.show({ color: "teal", message: "PDF uploaded as a new draft." });
    },
    onError: handleError,
  });

  const updateVersionMutation = useMutation({
    mutationFn: ({ versionId, content }: { versionId: number; content: string }) =>
      updateTermsVersion(eventId, versionId, content),
    onSuccess: () => {
      query.refetch();
      notifications.show({ color: "teal", message: "Draft updated." });
    },
    onError: handleError,
  });

  const publishMutation = useMutation({
    mutationFn: (versionId: number) => publishTermsVersion(eventId, versionId),
    onSuccess: () => {
      query.refetch();
      notifications.show({ color: "teal", message: "Terms published." });
    },
    onError: handleError,
  });

  const toggleEnabledMutation = useMutation({
    mutationFn: (enabled: boolean) => updateTermsConfig(eventId, enabled),
    onSuccess: () => query.refetch(),
    onError: handleError,
  });

  if (query.isLoading) {
    return (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    );
  }

  const canEnable = currentVersion?.status === "PUBLISHED";

  return (
    <Stack gap="xl">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Stack gap={0}>
            <Text fw={600}>Require acceptance at checkout</Text>
            <Text size="sm" c="dimmed" maw={480}>
              When enabled, buyers must accept the published version below before completing a paid, tiered,
              registration, or donation checkout. Free-only carts are never gated.
            </Text>
          </Stack>
          <Switch
            checked={terms?.enabled ?? false}
            disabled={disabled || !canEnable || toggleEnabledMutation.isPending}
            onChange={(event) => toggleEnabledMutation.mutate(event.currentTarget.checked)}
          />
        </Group>
        {!canEnable && (
          <Alert color="gray" variant="light">
            Publish a version below before you can require acceptance.
          </Alert>
        )}
      </Stack>

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
                href={`/api/events/${eventId}/terms/versions/${currentVersion.id}/pdf`}
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
                label="Terms & Conditions"
                description="This is what buyers will be asked to accept once published."
                required={false}
                value={draftText || draftVersion.rich_text_content || ""}
                onChange={setDraftText}
                disabled={disabled}
              />
            ) : (
              <Button
                component="a"
                href={`/api/events/${eventId}/terms/versions/${draftVersion.id}/pdf`}
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
                label="Terms & Conditions"
                description="This is what buyers will be asked to accept once published."
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
              <Text fw={600}>{currentVersion ? "Start a new draft" : "No Terms & Conditions yet"}</Text>
              <Text size="sm" c="dimmed" ta="center" maw={420}>
                Write rich-text terms directly, or upload a PDF. Once published, a version is permanent — editing
                always creates a new draft rather than changing what buyers already accepted.
              </Text>
              <Group>
                <Button
                  variant="light"
                  onClick={() => {
                    setDraftText(currentVersion?.content_type === "RICH_TEXT" ? currentVersion.rich_text_content ?? "" : "");
                    setCreating("write");
                  }}
                >
                  Write terms
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
          <Title order={5}>Version history</Title>
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
                    href={`/api/events/${eventId}/terms/versions/${version.id}/pdf`}
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
