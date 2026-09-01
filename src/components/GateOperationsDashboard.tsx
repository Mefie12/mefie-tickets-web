"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Group, SimpleGrid, Stack, Table, Text, Title } from "@mantine/core";
import { closeGateOperations, getGateOperations, reviewGateConflict, updateGateDevice } from "@/lib/gateOperationsApi";

export function GateOperationsDashboard({ eventId }: { eventId: number }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["gate-operations", eventId], queryFn: () => getGateOperations(eventId), refetchInterval: 15_000 });
  const refresh = () => client.invalidateQueries({ queryKey: ["gate-operations", eventId] });
  const device = useMutation({ mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "PAUSED" | "RETIRED" }) => updateGateDevice(eventId, id, status), onSuccess: refresh });
  const review = useMutation({ mutationFn: (id: number) => reviewGateConflict(eventId, id), onSuccess: refresh });
  const close = useMutation({ mutationFn: () => closeGateOperations(eventId), onSuccess: refresh });
  const data = query.data;

  if (query.isError) return <Alert color="red">Gate operations could not be loaded.</Alert>;
  if (!data) return <Text c="dimmed">Loading gate operations…</Text>;

  return <Stack gap="xl">
    <Group justify="space-between" align="flex-start">
      <div><Title order={2}>Gate operations</Title><Text c="dimmed">Live readiness, synchronization, and reconciliation status.</Text></div>
      <Group><Badge color={data.operations_status === "OPEN" ? "teal" : "gray"}>{data.operations_status}</Badge>
        {data.operations_status === "OPEN" && <Button color="red" variant="light" onClick={() => {
          if (window.confirm("Close gate operations? New admissions will stop when scanners reconnect, and no new offline grants will be issued.")) close.mutate();
        }} loading={close.isPending}>Close event gates</Button>}
      </Group>
    </Group>
    <SimpleGrid cols={{ base: 2, md: 6 }}>
      {[["Online", data.summary.devices_online], ["Degraded", data.summary.devices_degraded], ["Not ready", data.summary.devices_not_ready], ["Pending", data.summary.pending_operations], ["Conflicts", data.summary.conflicts], ["Admitted", data.summary.canonical_admitted]].map(([label, value]) =>
        <Card withBorder key={label as string}><Text size="xs" c="dimmed">{label}</Text><Text fw={700} size="xl">{value}</Text></Card>)}
    </SimpleGrid>
    <Card withBorder><Title order={3} mb="md">Devices</Title><Table.ScrollContainer minWidth={900}><Table striped highlightOnHover>
      <Table.Thead><Table.Tr><Table.Th>Device</Table.Th><Table.Th>Status</Table.Th><Table.Th>Readiness</Table.Th><Table.Th>Last sync</Table.Th><Table.Th>Pending</Table.Th><Table.Th>Conflicts</Table.Th><Table.Th>Actions</Table.Th></Table.Tr></Table.Thead>
      <Table.Tbody>{data.devices.map((item) => <Table.Tr key={item.device_registration_id}>
        <Table.Td>{item.label}</Table.Td><Table.Td>{item.status}</Table.Td><Table.Td>{item.readiness ?? "Not reported"}</Table.Td>
        <Table.Td>{item.last_sync_at ? new Date(item.last_sync_at).toLocaleString() : "Never"}</Table.Td><Table.Td>{item.pending}</Table.Td><Table.Td>{item.conflicts}</Table.Td>
        <Table.Td><Group gap="xs">{item.status === "ACTIVE" ? <Button size="xs" variant="light" color="yellow" onClick={() => device.mutate({ id: item.device_registration_id, status: "PAUSED" })}>Pause</Button> : item.status === "PAUSED" ? <Button size="xs" variant="light" onClick={() => device.mutate({ id: item.device_registration_id, status: "ACTIVE" })}>Resume</Button> : null}<Button size="xs" variant="subtle" color="red" disabled={item.status === "RETIRED"} onClick={() => device.mutate({ id: item.device_registration_id, status: "RETIRED" })}>Retire</Button></Group></Table.Td>
      </Table.Tr>)}</Table.Tbody>
    </Table></Table.ScrollContainer></Card>
    {data.conflicts.length > 0 && <Card withBorder><Title order={3} mb="md">Open conflicts</Title><Stack>{data.conflicts.map((conflict) => <Group justify="space-between" key={conflict.id}><Text>Operation {conflict.operation_id} · {new Date(conflict.created_at).toLocaleString()}</Text><Button size="xs" variant="light" onClick={() => review.mutate(conflict.id)}>Mark reviewed</Button></Group>)}</Stack></Card>}
  </Stack>;
}
