"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { Badge, Box, Button, Card, Group, Pagination, Popover, Select, Stack, Table, Text, TextInput, Title, Tooltip } from "@mantine/core";
import { IconAdjustmentsHorizontal, IconSearch } from "@tabler/icons-react";
import { TableScrollShadow } from "@/components/TableScrollShadow";
import type { EventGate } from "@/lib/gateRoutingApi";
import { exportGateAdmissionsUrl, listGateAdmissions } from "@/lib/gateOperationsApi";

type DeviceOption = { device_registration_id: string; label: string };

function TwoLine({ primary, secondary }: { primary: React.ReactNode; secondary: React.ReactNode }) {
  return (
    <Stack gap={2}>
      <Text fw={600} size="sm" lh={1.2}>{primary}</Text>
      <Text size="xs" c="dimmed">{secondary}</Text>
    </Stack>
  );
}

function triggerDownload(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function GateAdmissionsFeed({
  eventId,
  gates,
  devices,
  deviceFilter,
  onDeviceFilterChange,
}: {
  eventId: number;
  gates: EventGate[];
  devices: DeviceOption[];
  deviceFilter: string | null;
  onDeviceFilterChange: (id: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [debouncedQ] = useDebouncedValue(q, 300);
  const [eventGateId, setEventGateId] = useState<string | null>(null);
  const [gateLaneId, setGateLaneId] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const laneOptions = useMemo(
    () => gates.find((g) => String(g.id) === eventGateId)?.lanes.map((l) => ({ value: String(l.id), label: l.name })) ?? [],
    [gates, eventGateId],
  );
  const gateOptions = useMemo(() => gates.map((g) => ({ value: String(g.id), label: g.name })), [gates]);
  const deviceOptions = useMemo(() => devices.map((d) => ({ value: d.device_registration_id, label: d.label })), [devices]);

  // Reset paging whenever the query that feeds the table changes — during render
  // (guarded), not in an effect, same pattern as OrdersAttendeesTable.
  const filterKey = [debouncedQ, eventGateId, gateLaneId, deviceFilter, from, to, status].join("|");
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
  }

  const hasFilters = Boolean(eventGateId || gateLaneId || deviceFilter || from || to || status);
  function clearFilters() {
    setEventGateId(null);
    setGateLaneId(null);
    onDeviceFilterChange(null);
    setFrom("");
    setTo("");
    setStatus(null);
  }

  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page) });
    if (debouncedQ.trim()) p.set("q", debouncedQ.trim());
    if (eventGateId) p.set("event_gate_id", eventGateId);
    if (gateLaneId) p.set("gate_lane_id", gateLaneId);
    if (deviceFilter) p.set("device_registration_id", deviceFilter);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (status) p.set("status", status);
    return p;
  }, [page, debouncedQ, eventGateId, gateLaneId, deviceFilter, from, to, status]);

  const query = useQuery({
    queryKey: ["gate-admissions", eventId, params.toString()],
    queryFn: () => listGateAdmissions(eventId, params),
    refetchInterval: 15_000,
    placeholderData: (previous) => previous,
  });
  const data = query.data;
  const rows = data?.admissions ?? [];
  const lastPage = data?.meta.last_page ?? 1;

  function exportCsv() {
    const exportParams = new URLSearchParams(params);
    exportParams.delete("page");
    triggerDownload(exportGateAdmissionsUrl(eventId, exportParams));
  }

  return (
    <Card withBorder id="gate-admissions-feed">
      <Group justify="space-between" align="flex-start" mb="md" wrap="wrap">
        <div>
          <Title order={3}>Check-in activity</Title>
          <Text c="dimmed" size="sm">{data?.meta.total ?? 0} admission{data?.meta.total === 1 ? "" : "s"}</Text>
        </div>
        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Search attendee or ticket"
            leftSection={<IconSearch size={16} />}
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            w={{ base: "100%", sm: 240 }}
          />
          <Popover position="bottom-end" withArrow shadow="md">
            <Popover.Target>
              <Button variant="default" leftSection={<IconAdjustmentsHorizontal size={16} />}>Filter</Button>
            </Popover.Target>
            <Popover.Dropdown>
              <Stack gap="sm" w={260}>
                <Select label="Entrance" clearable placeholder="Any" value={eventGateId}
                  onChange={(v) => { setEventGateId(v); setGateLaneId(null); }} data={gateOptions} />
                <Select label="Lane" clearable placeholder="Any" value={gateLaneId} onChange={setGateLaneId}
                  data={laneOptions} disabled={!eventGateId} />
                <Select label="Scanner" clearable placeholder="Any" value={deviceFilter}
                  onChange={onDeviceFilterChange} data={deviceOptions} />
                <Select label="Status" clearable placeholder="Admitted" value={status} onChange={setStatus}
                  data={[{ value: "admitted", label: "Admitted" }, { value: "reversed", label: "Reversed" }, { value: "all", label: "All" }]} />
                <TextInput type="date" label="From" value={from} onChange={(e) => setFrom(e.currentTarget.value)} />
                <TextInput type="date" label="To" value={to} onChange={(e) => setTo(e.currentTarget.value)} />
                {hasFilters && <Button variant="subtle" size="xs" c="dimmed" onClick={clearFilters}>Clear filters</Button>}
              </Stack>
            </Popover.Dropdown>
          </Popover>
          <Button variant="default" onClick={exportCsv}>Export</Button>
        </Group>
      </Group>

      <TableScrollShadow minWidth={880}>
        <Table highlightOnHover striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Attendee</Table.Th>
              <Table.Th>Ticket</Table.Th>
              <Table.Th>Entrance / lane</Table.Th>
              <Table.Th>Scanner</Table.Th>
              <Table.Th>Admitted at</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Td><TwoLine primary={`${row.attendee.first_name} ${row.attendee.last_name}`} secondary={row.attendee.email} /></Table.Td>
                <Table.Td><TwoLine primary={row.ticket.name} secondary={row.ticket.reference} /></Table.Td>
                <Table.Td><TwoLine primary={row.gate.name ?? "—"} secondary={row.lane.name ?? "—"} /></Table.Td>
                <Table.Td><Text size="sm">{row.device.label ?? "Unknown device"}</Text></Table.Td>
                <Table.Td><Text size="sm" c="dimmed">{new Date(row.admitted_at).toLocaleString()}</Text></Table.Td>
                <Table.Td>
                  {row.status === "ADMITTED" ? (
                    <Badge color="teal" variant="light">Admitted</Badge>
                  ) : (
                    <Tooltip label={[row.reversal_reason, row.reversed_by_device_label && `Reversed by ${row.reversed_by_device_label}`].filter(Boolean).join(" — ") || "Reversed"}>
                      <Badge color="red" variant="light">Reversed</Badge>
                    </Tooltip>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </TableScrollShadow>

      {!query.isLoading && rows.length === 0 && (
        <Box p="xl">
          <Text ta="center" c="dimmed">No admissions match these filters.</Text>
        </Box>
      )}

      {lastPage > 1 && (
        <Group justify="flex-end" mt="md">
          <Pagination total={lastPage} value={page} onChange={setPage} siblings={1} boundaries={1} color="blue" />
        </Group>
      )}
    </Card>
  );
}
