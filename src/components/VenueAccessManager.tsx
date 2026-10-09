"use client";

import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Group, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconEye, IconMailForward, IconSend } from "@tabler/icons-react";
import { ApiError } from "@/lib/authApi";
import { updateEvent } from "@/lib/eventApi";
import { DoorsOpenField } from "@/components/DoorsOpenField";
import { doorsChoiceFromMinutes, doorsMinutesFromChoice, doorsMinutesInvalid } from "@/lib/doorsOpen";
import { grantStatusPresentation, inviteVenueAgent, listVenueGrants, manageVenueGrant, type VenueGrant } from "@/lib/venueApi";

function DoorsTimeCard({ eventId, initialMinutes, startAt }: { eventId: number; initialMinutes: number | null; startAt: string }) {
  const [saved, setSaved] = useState<number | null>(initialMinutes);
  const [value, setValue] = useState(doorsChoiceFromMinutes(initialMinutes));
  const minutes = doorsMinutesFromChoice(value);
  const invalid = doorsMinutesInvalid(minutes);
  const save = useMutation({
    mutationFn: () => updateEvent(eventId, { doors_open_minutes_before_start: minutes }),
    onSuccess: (data) => {
      setSaved(data.event.doors_open_minutes_before_start ?? null);
      notifications.show({ color: "teal", message: minutes === null ? "Doors time cleared." : "Doors time saved." });
    },
    onError: (error: Error) => notifications.show({ color: "red", message: error.message }),
  });

  return (
    <Card withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">The same setting lives with the event&apos;s date and time in Event Settings; changing it in either place changes both.</Text>
        <DoorsOpenField value={value} onChange={setValue} startAt={startAt} />
        <Button onClick={() => save.mutate()} loading={save.isPending} disabled={invalid || minutes === saved} style={{ alignSelf: "flex-start" }}>Save</Button>
      </Stack>
    </Card>
  );
}

export function VenueAccessManager({ eventId, initialDoorsMinutes, startAt, archived }: { eventId: number; initialDoorsMinutes: number | null; startAt: string; archived: boolean }) {
  const cache = useQueryClient();
  const queryKey = ["venue-grants", eventId];
  const grants = useQuery({ queryKey, queryFn: () => listVenueGrants(eventId) });
  const refresh = () => cache.invalidateQueries({ queryKey });
  const form = useForm({
    initialValues: { name: "", email: "" },
    validate: {
      name: (v) => (v.trim().length < 2 ? "Enter their name" : null),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v.trim()) ? null : "Enter a valid email"),
    },
  });

  const invite = useMutation({
    mutationFn: (values: { name: string; email: string }) => inviteVenueAgent(eventId, { name: values.name.trim(), email: values.email.trim() }),
    onSuccess: () => {
      notifications.show({ color: "teal", message: "Invitation sent." });
      form.reset();
      refresh();
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.errors) {
        form.setErrors(Object.fromEntries(Object.entries(error.errors).map(([field, messages]) => [field === "grant" || field === "event" ? "email" : field, messages[0]])));
      } else {
        notifications.show({ color: "red", message: error.message });
      }
    },
  });
  const manage = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "resend" | "revoke" | "keep-venue" }) => manageVenueGrant(eventId, id, action),
    onSuccess: (_, vars) => {
      notifications.show({ color: "teal", message: vars.action === "resend" ? "Invitation resent." : vars.action === "keep-venue" ? "Access kept for the new venue." : "Access removed." });
      refresh();
    },
    onError: (error: Error) => notifications.show({ color: "red", message: error.message }),
  });

  function confirmRevoke(grant: VenueGrant) {
    modals.openConfirmModal({
      title: grant.status === "ACTIVE" ? "Remove venue access?" : "Cancel this invitation?",
      centered: true,
      children: <Text size="sm">{grant.status === "ACTIVE" ? `${grant.name} will lose access to this event straight away.` : `${grant.name} will no longer be able to use the invitation link.`}</Text>,
      labels: { confirm: grant.status === "ACTIVE" ? "Remove access" : "Cancel invitation", cancel: "Keep" },
      confirmProps: { color: "red" },
      onConfirm: () => manage.mutate({ id: grant.id, action: "revoke" }),
    });
  }

  const list = grants.data?.grants ?? [];
  const live = list.filter((g) => g.status !== "REVOKED").length;
  const max = grants.data?.limits.max_live ?? 50;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Group gap="xs"><IconEye size={20} aria-hidden /><Title order={3}>Venue access</Title></Group>
          <Text size="sm" c="dimmed">Let someone from the venue follow how this event is going. They see ticket counts, expected attendance and live check-in numbers only.</Text>
        </Stack>
      </Group>

      <Alert color="blue" variant="light" title="What a venue agent can see">
        Event details, tickets sold, expected attendance, sold by ticket type, and checked-in numbers. They never see prices, revenue, attendee names or contact details, and cannot change anything. Their access ends {grants.data?.limits.access_grace_days ?? 7} days after the event, or as soon as you remove it.
      </Alert>

      <DoorsTimeCard eventId={eventId} initialMinutes={initialDoorsMinutes} startAt={startAt} />

      <Card withBorder radius="lg" p="lg">
        <form onSubmit={form.onSubmit((values) => invite.mutate(values))}>
          <Stack gap="sm">
            <Text fw={600}>Invite a venue agent</Text>
            {archived && <Alert color="yellow">Archived events cannot have venue agents.</Alert>}
            <Group align="flex-start" gap="sm" grow>
              <TextInput label="Name" placeholder="Ama Mensah" {...form.getInputProps("name")} disabled={archived} />
              <TextInput label="Email" type="email" placeholder="ama@venue.com" {...form.getInputProps("email")} disabled={archived} />
            </Group>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">{live} of {max} agents used</Text>
              <Button type="submit" leftSection={<IconSend size={16} />} loading={invite.isPending} disabled={archived || live >= max}>Send invitation</Button>
            </Group>
          </Stack>
        </form>
      </Card>

      <Card withBorder radius="lg" p="lg">
        <Text fw={600} mb="sm">Agents</Text>
        {grants.isLoading && <Text size="sm" c="dimmed">Loading…</Text>}
        {grants.isError && <Alert color="yellow">Could not load venue agents. Try refreshing the page.</Alert>}
        {grants.data && list.length === 0 && <Text size="sm" c="dimmed">No venue agents yet.</Text>}
        {list.length > 0 && (
          <Table.ScrollContainer minWidth={560}>
            <Table verticalSpacing="xs">
              <Table.Thead><Table.Tr><Table.Th>Name</Table.Th><Table.Th>Email</Table.Th><Table.Th>Status</Table.Th><Table.Th /></Table.Tr></Table.Thead>
              <Table.Tbody>
                {list.map((grant) => {
                  const status = grantStatusPresentation(grant.display_status);
                  const pending = grant.status === "INVITED";

                  return (
                    <Fragment key={grant.id}>
                    <Table.Tr style={grant.venue_changed ? { borderBottom: "none" } : undefined}>
                      <Table.Td>{grant.name}</Table.Td>
                      <Table.Td>{grant.email}</Table.Td>
                      <Table.Td><Badge color={status.color} variant="light" styles={{ label: { overflow: "visible" } }}>{status.label}</Badge></Table.Td>
                      <Table.Td>
                        <Group gap="xs" justify="flex-end" wrap="nowrap">
                          {grant.venue_changed && <Button size="compact-sm" variant="light" color="orange" loading={manage.isPending && manage.variables?.id === grant.id && manage.variables.action === "keep-venue"} onClick={() => manage.mutate({ id: grant.id, action: "keep-venue" })}>Keep access</Button>}
                          {pending && <Button size="compact-sm" variant="subtle" leftSection={<IconMailForward size={14} />} loading={manage.isPending && manage.variables?.id === grant.id && manage.variables.action === "resend"} onClick={() => manage.mutate({ id: grant.id, action: "resend" })}>Resend</Button>}
                          {grant.status !== "REVOKED" && <Button size="compact-sm" variant="subtle" color="red" onClick={() => confirmRevoke(grant)}>{pending ? "Cancel" : "Remove"}</Button>}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                    {grant.venue_changed && (
                      <Table.Tr>
                        <Table.Td colSpan={4} pt={0}>
                          <Alert color="orange" variant="light" p="xs">
                            <Text size="xs">Venue changed: {grant.name} was invited for <strong>{grant.venue_name_at_invite}</strong>, and this event is now at <strong>{grant.current_venue_name ?? "no venue"}</strong>. They can still see this event until you remove them. Keep access if that is intended.</Text>
                          </Alert>
                        </Table.Td>
                      </Table.Tr>
                    )}
                    </Fragment>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>
    </Stack>
  );
}
