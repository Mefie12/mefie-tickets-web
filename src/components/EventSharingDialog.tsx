"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, Group, Modal, Select, Stack, Table, Text, Textarea, Title, Tooltip } from "@mantine/core";
import { IconChevronDown, IconEyeOff, IconLink, IconLock, IconWorld } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import type { EventVisibility } from "@/lib/eventApi";

function visibilityLabel(visibility: EventVisibility): string {
  return visibility === "PUBLIC" ? "Public" : visibility === "UNLISTED" ? "Anyone with the link" : "Invite only";
}

type DeliveryStatus = "ACCEPTED" | "DELIVERED" | "BOUNCED" | "COMPLAINED" | "FAILED" | null;
type Invitation = {
  id: number;
  email: string;
  sent_at: string | null;
  delivery_status: DeliveryStatus;
  delivery_error: string | null;
};

/** Never-sent, or the last attempt FAILED/BOUNCED — mirrors the backend's EventInvitationService::outstandingQuery(). Deliberately excludes COMPLAINED. */
function isOutstanding(invitation: Invitation): boolean {
  return !invitation.sent_at || invitation.delivery_status === "FAILED" || invitation.delivery_status === "BOUNCED";
}

/**
 * `sent_at` alone only ever meant "we attempted to send" — never whether
 * it worked. delivery_status carries the real outcome, set once
 * SendEventInvitationEmailJob has actually run (ACCEPTED/FAILED) and
 * later refined by the Resend delivery/bounce/complaint webhook
 * (DELIVERED/BOUNCED/COMPLAINED) — see that job's and
 * ProcessProviderWebhookReceiptJob's docblocks. `null` covers both "not
 * sent yet" and "sent via a non-Resend transport we can't track" (e.g.
 * local dev's log driver) — those are told apart by `sent_at` instead.
 */
function deliveryBadge(invitation: Invitation, live: boolean): { label: string; color: string; tooltip?: string } {
  if (!invitation.sent_at) {
    return live ? { label: "Not sent", color: "gray" } : { label: "After publish", color: "gray" };
  }
  switch (invitation.delivery_status) {
    case "DELIVERED":
      return { label: "Delivered", color: "teal" };
    case "BOUNCED":
      return { label: "Bounced", color: "red", tooltip: invitation.delivery_error ?? "This address rejected the email." };
    case "COMPLAINED":
      return { label: "Marked as spam", color: "orange" };
    case "FAILED":
      return { label: "Failed to send", color: "red", tooltip: invitation.delivery_error ?? "The email could not be sent." };
    case "ACCEPTED":
    default:
      return { label: "Sent", color: "teal" };
  }
}
type SharingData = { visibility: EventVisibility; invitations: Invitation[] };

export function EventSharingDialog({
  target,
  id,
  title,
  slug,
  organizationSlug,
  visibility: initialVisibility,
  archived,
  live,
}: {
  target: "events" | "event-series";
  id: number;
  title: string;
  slug: string;
  organizationSlug: string;
  visibility: EventVisibility;
  archived: boolean;
  live: boolean;
}) {
  const [opened, setOpened] = useState(false);
  const [emails, setEmails] = useState("");
  const queryClient = useQueryClient();
  const base = `/api/${target}/${id}`;
  const itemLabel = target === "event-series" ? "series" : "event";
  const itemPlural = target === "event-series" ? "series" : "events";
  const sharing = useQuery({
    queryKey: ["event-sharing", target, id],
    queryFn: async () => {
      const response = await fetch(`${base}/sharing`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Could not load sharing settings.");
      return body as SharingData;
    },
    enabled: opened,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["event-sharing", target, id] });
  const visibility = sharing.data?.visibility ?? initialVisibility;
  const visibilityName = visibility === "PUBLIC" ? "Public" : visibility === "UNLISTED" ? "Unlisted" : "Invite only";
  const stateLabel = archived
    ? `${visibilityName} · archived`
    : !live
      ? `${visibilityName} · draft`
      : visibility === "PUBLIC" ? "Public · listed" : visibility === "UNLISTED" ? "Unlisted · link only" : "Invite only";
  const stateDescription = archived
    ? "Unavailable while archived"
    : !live
      ? "Visibility applies after publication"
      : visibility === "PUBLIC" ? `Anyone can find this ${itemLabel}` : visibility === "UNLISTED" ? "Hidden from listings · link works" : "Only invited people can view";
  const stateColor = archived || !live ? "gray" : visibility === "PUBLIC" ? "teal" : visibility === "UNLISTED" ? "blue" : "violet";
  const StateIcon = archived || !live ? IconEyeOff : visibility === "PUBLIC" ? IconWorld : visibility === "UNLISTED" ? IconLink : IconLock;
  const visibilityMutation = useMutation({
    mutationFn: async (visibility: EventVisibility) => {
      const response = await fetch(`${base}/sharing`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visibility }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Could not update access.");
      return body;
    },
    onSuccess: refresh,
    onError: (error) => notifications.show({ color: "red", message: error.message }),
  });
  /**
   * A published event's link may already be shared/bookmarked/indexed —
   * changing access here takes effect immediately for anyone who already
   * has that link, so this confirms before firing the PATCH rather than
   * silently cutting people off (or, when opening access up, silently
   * exposing something the organizer meant to keep gated).
   */
  function confirmVisibilityChange(next: EventVisibility) {
    if (next === visibility) return;
    if (!live) {
      visibilityMutation.mutate(next);
      return;
    }
    const narrowing = visibility === "PUBLIC" ? next !== "PUBLIC" : visibility === "UNLISTED" && next === "INVITED";
    // Only switching TO "Invited people only" actually gates viewing —
    // PUBLIC -> UNLISTED stays narrowing (loses its listing) but a link
    // anyone already has keeps working, so it gets its own copy instead
    // of the "will be blocked" language that would otherwise be false.
    const blocksExistingViewers = next === "INVITED";
    modals.openConfirmModal({
      title: `Change access to "${visibilityLabel(next)}"?`,
      centered: true,
      children: (
        <Text size="sm">
          {blocksExistingViewers
            ? `This ${itemLabel} is currently ${visibilityName}, so people may already have its link, have it bookmarked, or have found it in search. Switching to "${visibilityLabel(next)}" takes effect immediately — anyone without access under the new setting will be blocked right away, even with a link they already had. Tickets already bought aren't affected.`
            : narrowing
              ? `This ${itemLabel} is currently ${visibilityName}, so people may already have its link, have it bookmarked, or have found it in search. Switching to "${visibilityLabel(next)}" takes it out of listings and search — but a link anyone already has will keep working, same as before.`
              : `This makes the ${itemLabel} more open than it is now. As soon as you confirm, anyone who qualifies under "${visibilityLabel(next)}" will be able to view it — including via a link that was previously blocked.`}
        </Text>
      ),
      labels: { confirm: "Change access", cancel: "Cancel" },
      confirmProps: { color: narrowing ? "orange" : "teal" },
      onConfirm: () => visibilityMutation.mutate(next),
    });
  }
  const addMutation = useMutation({
    mutationFn: async () => {
      const normalized = [...new Set(emails.split(/[\s,;]+/).map((value) => value.trim()).filter(Boolean))];
      const response = await fetch(`${base}/invitations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails: normalized }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Could not add invitees.");
      return body;
    },
    // Adding never sends anything, no exceptions — sending is a fully
    // separate, explicit action (mutateInvitation "send" / sendOutstandingMutation below).
    onSuccess: () => { setEmails(""); refresh(); notifications.show({ color: "teal", message: "Invitees added." }); },
    onError: (error) => notifications.show({ color: "red", message: error.message }),
  });
  async function mutateInvitation(invitation: Invitation, action: "remove" | "send") {
    const url = action === "remove" ? `${base}/invitations/${invitation.id}` : `${base}/invitations/${invitation.id}/send`;
    const response = await fetch(url, { method: action === "remove" ? "DELETE" : "POST" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message ?? "That action could not be completed.");
    await refresh();
    notifications.show({ color: "teal", message: action === "remove" ? "Access removed." : "Invitation sent." });
  }
  const outstanding = sharing.data?.invitations.filter(isOutstanding) ?? [];
  const sendOutstandingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${base}/invitations/send-outstanding`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Could not send invitations.");
      return body as { message: string; count: number };
    },
    onSuccess: (result) => { refresh(); notifications.show({ color: "teal", message: result.message }); },
    onError: (error) => notifications.show({ color: "red", message: error.message }),
  });
  /** A bulk click of exactly one outstanding invitee behaves like a single send — no confirmation dialog for a "bulk" action of one. */
  function handleSendOutstandingClick() {
    if (outstanding.length <= 1) {
      sendOutstandingMutation.mutate();
      return;
    }
    modals.openConfirmModal({
      title: `Send to ${outstanding.length} people?`,
      centered: true,
      children: <Text size="sm">This emails everyone who hasn&apos;t been sent a working invite yet — never-sent invitees, and anyone whose last email failed or bounced.</Text>,
      labels: { confirm: `Send to ${outstanding.length}`, cancel: "Cancel" },
      onConfirm: () => sendOutstandingMutation.mutate(),
    });
  }

  return <>
    <Card withBorder radius="lg" p="lg" maw={640}>
      <Group justify="space-between" align="center" wrap="nowrap">
        <Stack gap="xs">
          <Title order={4} fz={18}>Public sharing</Title>
          <Group gap="xs">
            <Badge color={stateColor} variant="light" leftSection={<StateIcon size={12} />}>{stateLabel}</Badge>
            <Text size="sm" c="dimmed">{stateDescription}</Text>
          </Group>
        </Stack>
        <Button
          variant="light"
          color={stateColor}
          size="sm"
          radius="md"
          leftSection={<StateIcon size={16} />}
          rightSection={<IconChevronDown size={14} />}
          aria-label={`Edit sharing. ${stateLabel}. ${stateDescription}.`}
          onClick={() => setOpened(true)}
        >Manage</Button>
      </Group>
    </Card>
    <Modal opened={opened} onClose={() => setOpened(false)} title={`Sharing · ${title}`} centered size="lg">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap={3}>
            <Text fw={600}>Who can access this event?</Text>
            <Text size="sm" c="dimmed">Choose whether people can discover it, open it by link, or need an invitation.</Text>
          </Stack>
          <Badge color={stateColor} variant="light" leftSection={<StateIcon size={12} />}>{stateLabel}</Badge>
        </Group>
        {archived && <Alert color="gray" title="Sharing is paused">This {itemLabel} is archived and unavailable to the public. Restore it as a draft before changing access.</Alert>}
        {!live && !archived && <Alert color="blue" title="Not public yet">Set up sharing now. The {itemLabel} and invitations become available after publication.</Alert>}
        <Select
          label="General access"
          description={`Public ${itemPlural} appear in listings. Unlisted links can be forwarded. Invite-only access requires a verified invited email.`}
          value={visibility}
          data={[{ value: "PUBLIC", label: "Public" }, { value: "UNLISTED", label: "Anyone with the link" }, { value: "INVITED", label: "Invited people only" }]}
          disabled={archived || sharing.isLoading || visibilityMutation.isPending}
          onChange={(value) => value && confirmVisibilityChange(value as EventVisibility)}
        />
        <Group justify="space-between">
          <Text size="sm" c="dimmed">{visibility === "PUBLIC" ? `Listed publicly and viewable by anyone.` : visibility === "UNLISTED" ? "Hidden from public listings; anyone with the link can view." : "Invitees can view and buy; verified ticket holders can view their date."}</Text>
          <Button
            variant="default"
            size="xs"
            leftSection={<IconLink size={14} />}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${window.location.origin}/${organizationSlug}/${slug}`);
                notifications.show({ color: "teal", message: "Event link copied." });
              } catch {
                notifications.show({ color: "red", message: "Could not copy the link. You can copy it from your browser address bar." });
              }
            }}
          >Copy link</Button>
        </Group>
        <Stack gap="xs">
          <Text fw={600}>Invite people{target === "event-series" ? " to this series" : ""}</Text>
          {target === "event-series" && <Text size="sm" c="dimmed">An invitation applies to every current and future date in this series.</Text>}
          <Textarea label="Email addresses" description="Separate addresses with commas, spaces, or new lines." placeholder="name@example.com" value={emails} onChange={(event) => setEmails(event.currentTarget.value)} disabled={archived} autosize minRows={2} />
          <Text size="xs" c="dimmed">
            Adding someone here only gives them access — it never emails them. Send invitations separately, below,
            once you&apos;re ready.
          </Text>
          <Group justify="flex-end">
            <Button onClick={() => addMutation.mutate()} loading={addMutation.isPending} disabled={archived || !emails.trim()}>
              Add invitees
            </Button>
          </Group>
        </Stack>
        {sharing.isError && <Alert color="red">{sharing.error.message}</Alert>}
        <Group justify="space-between" align="baseline">
          <Text fw={600} size="sm">People with access</Text>
          {sharing.data && <Text size="xs" c="dimmed">{sharing.data.invitations.length} invitee{sharing.data.invitations.length === 1 ? "" : "s"}</Text>}
        </Group>
        {!live && !archived && sharing.data?.invitations.length ? (
          <Text size="xs" c="dimmed">Publish this {itemLabel} before sending invitations — the link won&apos;t work until then.</Text>
        ) : null}
        {live && outstanding.length > 0 && (
          <Group justify="flex-end">
            <Button size="xs" variant="light" loading={sendOutstandingMutation.isPending} disabled={archived} onClick={handleSendOutstandingClick}>
              Send outstanding ({outstanding.length})
            </Button>
          </Group>
        )}
        {sharing.data?.invitations.length ? <Table><Table.Thead><Table.Tr><Table.Th>Email</Table.Th><Table.Th>Invitation</Table.Th><Table.Th /></Table.Tr></Table.Thead><Table.Tbody>
          {sharing.data.invitations.map((invitation) => {
            const badge = deliveryBadge(invitation, live);
            const badgeEl = <Badge size="sm" variant="light" color={badge.color}>{badge.label}</Badge>;
            const sendLabel = invitation.sent_at ? "Resend" : "Send";
            return <Table.Tr key={invitation.id}><Table.Td>{invitation.email}</Table.Td><Table.Td>{badge.tooltip ? <Tooltip label={badge.tooltip} multiline w={260}>{badgeEl}</Tooltip> : badgeEl}</Table.Td><Table.Td><Group gap="xs" justify="flex-end">{live && <Button size="compact-xs" variant="subtle" disabled={archived} onClick={() => void mutateInvitation(invitation, "send").catch((error) => notifications.show({ color: "red", message: error.message }))}>{sendLabel}</Button>}<Button size="compact-xs" color="red" variant="subtle" disabled={archived} onClick={() => void mutateInvitation(invitation, "remove").catch((error) => notifications.show({ color: "red", message: error.message }))}>Remove</Button></Group></Table.Td></Table.Tr>;
          })}
        </Table.Tbody></Table> : <Text size="sm" c="dimmed">No invitations yet.</Text>}
      </Stack>
    </Modal>
  </>;
}
