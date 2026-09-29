"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, Checkbox, Group, Modal, Select, Stack, Table, Text, Textarea, Title } from "@mantine/core";
import { IconChevronDown, IconEyeOff, IconLink, IconLock, IconWorld } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import type { EventVisibility } from "@/lib/eventApi";

type Invitation = { id: number; email: string; notify_on_publish: boolean; sent_at: string | null };
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
  const [notify, setNotify] = useState(true);
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
  const addMutation = useMutation({
    mutationFn: async () => {
      const normalized = [...new Set(emails.split(/[\s,;]+/).map((value) => value.trim()).filter(Boolean))];
      const response = await fetch(`${base}/invitations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails: normalized, notify }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Could not add invitees.");
      return body;
    },
    onSuccess: () => { setEmails(""); refresh(); notifications.show({ color: "teal", message: live && notify ? "Invitation sent." : "Invitees added." }); },
    onError: (error) => notifications.show({ color: "red", message: error.message }),
  });
  async function mutateInvitation(invitation: Invitation, action: "remove" | "resend") {
    const method = action === "remove" ? "DELETE" : "POST";
    const response = await fetch(`${base}/invitations/${invitation.id}`, { method });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message ?? "That action could not be completed.");
    await refresh();
    notifications.show({ color: "teal", message: action === "remove" ? "Access removed." : "Invitation sent." });
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
          onChange={(value) => value && visibilityMutation.mutate(value as EventVisibility)}
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
          <Checkbox label="Email invitees when access is ready" description={!live && !archived ? "We'll send these after you publish." : "Send an invitation email now."} checked={notify} onChange={(event) => setNotify(event.currentTarget.checked)} disabled={archived} />
          <Group justify="flex-end">
            <Button onClick={() => addMutation.mutate()} loading={addMutation.isPending} disabled={archived || !emails.trim()}>
              {live ? "Add invitees" : "Save invitees"}
            </Button>
          </Group>
        </Stack>
        {sharing.isError && <Alert color="red">{sharing.error.message}</Alert>}
        <Group justify="space-between" align="baseline">
          <Text fw={600} size="sm">People with access</Text>
          {sharing.data && <Text size="xs" c="dimmed">{sharing.data.invitations.length} invitee{sharing.data.invitations.length === 1 ? "" : "s"}</Text>}
        </Group>
        {sharing.data?.invitations.length ? <Table><Table.Thead><Table.Tr><Table.Th>Email</Table.Th><Table.Th>Invitation</Table.Th><Table.Th /></Table.Tr></Table.Thead><Table.Tbody>
          {sharing.data.invitations.map((invitation) => <Table.Tr key={invitation.id}><Table.Td>{invitation.email}</Table.Td><Table.Td><Badge size="sm" variant="light" color={invitation.sent_at ? "teal" : "gray"}>{invitation.sent_at ? "Sent" : live ? "Not sent" : "After publish"}</Badge></Table.Td><Table.Td><Group gap="xs" justify="flex-end">{live && <Button size="compact-xs" variant="subtle" disabled={archived} onClick={() => void mutateInvitation(invitation, "resend").catch((error) => notifications.show({ color: "red", message: error.message }))}>Resend</Button>}<Button size="compact-xs" color="red" variant="subtle" disabled={archived} onClick={() => void mutateInvitation(invitation, "remove").catch((error) => notifications.show({ color: "red", message: error.message }))}>Remove</Button></Group></Table.Td></Table.Tr>)}
        </Table.Tbody></Table> : <Text size="sm" c="dimmed">No invitations yet.</Text>}
      </Stack>
    </Modal>
  </>;
}
