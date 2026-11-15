"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Group, Loader, Stack, Text } from "@mantine/core";
import { AcceptLegalDialog } from "@/components/AcceptLegalDialog";
import { acknowledgeLegalNotices, getOrganizationLegalPending } from "@/lib/organizationLegalApi";

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null);

/**
 * What the organization still has to agree to, and which document changes it has been told about.
 * `banner` is the compact dashboard strip (renders nothing when there is nothing to show);
 * the full version is the Settings > Legal page.
 */
export function OrganizationLegalPanel({ banner = false }: { banner?: boolean }) {
  const queryClient = useQueryClient();
  const [reviewing, setReviewing] = useState(false);
  const query = useQuery({ queryKey: ["organization-legal"], queryFn: getOrganizationLegalPending, staleTime: 60_000 });
  const acknowledge = useMutation({
    mutationFn: (versionIds: number[]) => acknowledgeLegalNotices(versionIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organization-legal"] }),
  });

  if (query.isLoading) return banner ? null : <Loader size="sm" />;
  const pending = query.data;
  if (!pending) return banner ? null : <Text c="dimmed">Could not load your legal documents.</Text>;
  if (banner && pending.to_accept.length === 0 && pending.notices.length === 0) return null;

  const names = pending.to_accept.map((document) => document.name).join(", ");
  const enforced = pending.to_accept.map((document) => document.enforced_from).filter(Boolean).sort()[0] ?? null;

  return (
    <Stack gap="sm" mb={banner ? "md" : 0}>
      {pending.to_accept.length > 0 && (
        <Alert color="blue" title="New documents for your organization">
          <Stack gap="xs">
            <Text size="sm">
              {names} {pending.to_accept.length === 1 ? "applies" : "apply"} to organizers on Mefie Tickets.
              {pending.blocking
                ? " Accept to publish paid events or set up payouts."
                : enforced ? ` You'll be asked to accept before you publish a paid event or set up payouts from ${formatDate(enforced)}.` : ""}
            </Text>
            <Group gap="sm">
              <Button size="xs" onClick={() => setReviewing(true)}>Review and accept</Button>
              {pending.to_accept.map((document) => (
                <Text key={document.version_id} component={Link} href={`/legal/${document.slug}`} size="xs" target="_blank">Read {document.name}</Text>
              ))}
            </Group>
          </Stack>
        </Alert>
      )}
      {pending.notices.map((notice) => (
        <Alert key={notice.version_id} color="yellow" title={`${notice.name} is changing`}>
          <Stack gap="xs">
            {notice.change_summary && <Text size="sm">{notice.change_summary}</Text>}
            <Text size="sm">
              {notice.effective_at ? `Applies from ${formatDate(notice.effective_at)}. ` : ""}If you keep using Mefie Tickets after that, the updated version applies to your organization.
            </Text>
            <Group gap="sm">
              <Text component={Link} href={`/legal/${notice.slug}`} size="sm" target="_blank">Read the new version</Text>
              {pending.can_accept && (
                <Button size="xs" variant="light" loading={acknowledge.isPending} onClick={() => acknowledge.mutate([notice.version_id])}>Got it</Button>
              )}
            </Group>
          </Stack>
        </Alert>
      ))}
      {!banner && pending.to_accept.length === 0 && pending.notices.length === 0 && (
        <Text c="dimmed">You&apos;re up to date. There is nothing to accept or review.</Text>
      )}
      <AcceptLegalDialog
        opened={reviewing}
        documents={pending.to_accept}
        admins={pending.admins}
        canAccept={pending.can_accept}
        onAccepted={() => setReviewing(false)}
        onClose={() => setReviewing(false)}
      />
    </Stack>
  );
}
