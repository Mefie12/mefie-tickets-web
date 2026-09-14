"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge, Button, Card, Center, Group, Loader, Modal, Stack, Text, Textarea, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { createLegalDocument, listLegalDocuments, type LegalDocument } from "@/lib/legalDocumentsAdminApi";

const PLACEMENT_LABELS: Record<string, string> = {
  ACCOUNT_REGISTRATION: "Account registration",
  TICKET_CHECKOUT: "Ticket checkout",
};

export default function PlatformDocumentsPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const query = useQuery({ queryKey: ["legal-documents"], queryFn: listLegalDocuments });

  const form = useForm({ initialValues: { name: "", description: "" } });

  const createMutation = useMutation({
    mutationFn: () => createLegalDocument({ name: form.values.name, description: form.values.description || null }),
    onSuccess: ({ document }) => {
      setCreating(false);
      form.reset();
      router.push(`/admin/platform-documents/${document.slug}`);
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      if (error instanceof ApiError && error.errors) {
        form.setErrors(Object.fromEntries(Object.entries(error.errors).map(([field, messages]) => [field, messages[0]])));
      } else {
        notifications.show({ color: "red", message: error instanceof ApiError ? error.message : "Something went wrong." });
      }
    },
  });

  const documents = query.data?.documents ?? [];

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Title order={2}>Legal Documents</Title>
          <Text c="dimmed">
            Create any legal document your platform needs — Terms of Use, Privacy Policy, a Refund Policy, and more —
            then decide where each one appears. Editing here never changes what&apos;s already published; publishing
            always creates a new version.
          </Text>
        </Stack>
        <Button onClick={() => setCreating(true)}>Create document</Button>
      </Group>

      {query.isLoading ? (
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      ) : documents.length === 0 ? (
        <Text c="dimmed">No legal documents yet.</Text>
      ) : (
        <Stack gap="sm">
          {documents.map((document) => (
            <DocumentRow key={document.id} document={document} />
          ))}
        </Stack>
      )}

      <Modal opened={creating} onClose={() => setCreating(false)} title="Create a legal document">
        <form onSubmit={form.onSubmit(() => createMutation.mutate())}>
          <Stack>
            <TextInput label="Name" placeholder="Refund Policy" required {...form.getInputProps("name")} />
            <Textarea label="Internal description" placeholder="Optional note for other admins" autosize minRows={2} {...form.getInputProps("description")} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending} disabled={!form.values.name.trim()}>
                Create
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

function DocumentRow({ document }: { document: LegalDocument }) {
  const isPublished = document.current_version?.status === "PUBLISHED";
  const placementLabels = (document.placements ?? []).map((row) => PLACEMENT_LABELS[row.placement] ?? row.placement);

  return (
    <Card component={Link} href={`/admin/platform-documents/${document.slug}`} withBorder radius="lg" p="lg" style={{ textDecoration: "none" }}>
      <Group justify="space-between" wrap="nowrap">
        <Stack gap={4}>
          <Group gap="xs">
            <Text fw={600} c="var(--mantine-color-text)">
              {document.name}
            </Text>
            <Badge color={isPublished ? "teal" : "gray"}>{isPublished ? "Published" : "Draft only"}</Badge>
          </Group>
          <Text size="xs" c="dimmed">
            {placementLabels.length > 0 ? `Used on: ${placementLabels.join(", ")}` : "Not attached to any placement"}
          </Text>
        </Stack>
      </Group>
    </Card>
  );
}
