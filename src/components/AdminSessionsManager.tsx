"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useRouter } from "next/navigation";
import { endOtherAdminSessions, listAdminSessions, revokeAdminSession } from "@/lib/adminAuthApi";
import { redirectOnAdminAuthError } from "@/lib/adminAuthErrorRedirect";
export function AdminSessionsManager() {
  const router = useRouter(); const client = useQueryClient();
  const query = useQuery({ queryKey: ["admin-sessions"], queryFn: listAdminSessions });
  const refresh = () => client.invalidateQueries({ queryKey: ["admin-sessions"] });
  const revoke = useMutation({ mutationFn: revokeAdminSession, onSuccess: refresh, onError: (e) => redirectOnAdminAuthError(e, router) });
  const endOthers = useMutation({ mutationFn: endOtherAdminSessions, onSuccess: refresh, onError: (e) => redirectOnAdminAuthError(e, router) });
  function confirmRevoke(id: string) {
    modals.openConfirmModal({
      title: "Revoke this session?",
      centered: true,
      children: <Text size="sm">That device is signed out of the admin console immediately.</Text>,
      labels: { confirm: "Revoke", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => revoke.mutate(id),
    });
  }
  function confirmEndOthers() {
    modals.openConfirmModal({
      title: "End all other sessions?",
      centered: true,
      children: <Text size="sm">Every other browser or device with privileged console access is signed out immediately.</Text>,
      labels: { confirm: "End all other sessions", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => endOthers.mutate(),
    });
  }
  if (query.isLoading) return <Loader />; if (query.error) return <Alert color="red">Unable to load admin sessions.</Alert>;
  return <Stack><Group justify="space-between"><div><Title order={2}>Security sessions</Title><Text c="dimmed">Review browsers and devices with privileged console access.</Text></div><Button variant="light" color="red" onClick={confirmEndOthers} loading={endOthers.isPending}>End all other sessions</Button></Group>
    <Alert color="blue">Up to {query.data?.max_sessions ?? 5} privileged sessions are allowed. Sessions end after 60 minutes idle or eight hours total.</Alert>
    {query.data?.sessions.map((session) => <Card withBorder key={session.id}><Group justify="space-between" align="flex-start"><div><Group gap="xs"><Text fw={600}>{session.device_name}</Text>{session.current && <Badge>Current</Badge>}</Group><Text size="sm" c="dimmed">IP {session.ip_address ?? "Unavailable"}</Text><Text size="sm" c="dimmed">Last active {new Date(session.last_used_at).toLocaleString()}</Text><Text size="sm" c="dimmed">Expires {new Date(session.expires_at).toLocaleString()}</Text></div>{!session.current && <Button color="red" variant="light" onClick={() => confirmRevoke(session.id)} loading={revoke.isPending}>Revoke</Button>}</Group></Card>)}</Stack>;
}
