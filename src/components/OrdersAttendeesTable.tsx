"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  Menu,
  Pagination,
  Popover,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAdjustmentsHorizontal, IconDots, IconSearch } from "@tabler/icons-react";
import { exportOrdersUrl, listOrders, ORDER_STATUS, type OrderListItem, type OrderListResponse } from "@/lib/orderApi";
import { exportAttendeesUrl, listAttendees, type AttendeeListItem, type AttendeeListResponse } from "@/lib/attendeeApi";
import { formatAmount } from "@/lib/money";
import { formatEventDate } from "@/lib/eventDateTime";

type View = "orders" | "attendees";

const ADMISSION_STATUS: Record<AttendeeListItem["admission_status"], { c: string; label: string }> = {
  CONFIRMED: { c: "teal", label: "Confirmed" },
  PAYMENT_PENDING: { c: "yellow.7", label: "Payment pending" },
  RESERVED: { c: "blue", label: "Reserved" },
};

const tableStyles = {
  thead: { background: "var(--mantine-color-gray-1)" },
  th: { fontWeight: 600, color: "var(--mantine-color-gray-7)", padding: "14px 16px", fontSize: "var(--mantine-font-size-sm)" },
  td: { padding: "16px", verticalAlign: "middle" as const },
} as const;

function TwoLine({ primary, secondary }: { primary: React.ReactNode; secondary: React.ReactNode }) {
  return (
    <Stack gap={2}>
      <Text fw={600} size="sm" lh={1.2}>
        {primary}
      </Text>
      <Text size="xs" c="dimmed">
        {secondary}
      </Text>
    </Stack>
  );
}

function StatusLabel({ c, label }: { c: string; label: string }) {
  return (
    <Text component="span" size="sm" fw={500} c={c}>
      {label}
    </Text>
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

export function OrdersAttendeesTable({
  eventId,
  timezone,
  initialView,
  initialOrders,
  initialAttendees,
}: {
  eventId: number;
  timezone: string;
  initialView: View;
  initialOrders: OrderListResponse | null;
  initialAttendees: AttendeeListResponse | null;
}) {
  const router = useRouter();

  const [view, setView] = useState<View>(initialView);
  const [q, setQ] = useState("");
  const [debouncedQ] = useDebouncedValue(q, 300);
  const [page, setPage] = useState(1);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [admissionStatus, setAdmissionStatus] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Reset paging + selection whenever the query that feeds the table changes —
  // done during render (guarded) rather than in an effect, so there's no
  // extra render pass. See react.dev "You Might Not Need an Effect".
  const filterKey = [view, debouncedQ, orderStatus, from, to, admissionStatus, source, checkedIn].join("|");
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
    setSelected(new Set());
  }

  const isDefault =
    page === 1 && debouncedQ === "" && !orderStatus && !from && !to && !admissionStatus && !source && !checkedIn;

  const ordersParams = useMemo(() => {
    const p = new URLSearchParams({ page: String(page) });
    if (debouncedQ.trim()) p.set("q", debouncedQ.trim());
    if (orderStatus) p.set("status", orderStatus);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p;
  }, [page, debouncedQ, orderStatus, from, to]);

  const attendeesParams = useMemo(() => {
    const p = new URLSearchParams({ page: String(page) });
    if (debouncedQ.trim()) p.set("q", debouncedQ.trim());
    if (admissionStatus) p.set("admission_status", admissionStatus);
    if (source) p.set("admission_source", source);
    if (checkedIn) p.set("checked_in", checkedIn);
    return p;
  }, [page, debouncedQ, admissionStatus, source, checkedIn]);

  // Mirror the view into the URL for refresh/share, without a full navigation.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (view === "attendees") url.searchParams.set("view", "attendees");
    else url.searchParams.delete("view");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [view]);

  const ordersQuery = useQuery({
    queryKey: ["oa-table", "orders", eventId, ordersParams.toString()],
    queryFn: () => listOrders(eventId, ordersParams),
    enabled: view === "orders",
    initialData: view === "orders" && isDefault ? (initialOrders ?? undefined) : undefined,
    placeholderData: (previous) => previous,
  });

  const attendeesQuery = useQuery({
    queryKey: ["oa-table", "attendees", eventId, attendeesParams.toString()],
    queryFn: () => listAttendees(eventId, attendeesParams),
    enabled: view === "attendees",
    initialData: view === "attendees" && isDefault ? (initialAttendees ?? undefined) : undefined,
    placeholderData: (previous) => previous,
  });

  const activeQuery = view === "orders" ? ordersQuery : attendeesQuery;
  const rows: (OrderListItem | AttendeeListItem)[] =
    view === "orders" ? (ordersQuery.data?.orders ?? []) : (attendeesQuery.data?.attendees ?? []);
  const meta = activeQuery.data?.meta;
  const total = meta?.total ?? 0;
  const lastPage = meta?.last_page ?? 1;

  const rowId = (row: OrderListItem | AttendeeListItem) => ("short_id" in row ? row.id : (row as AttendeeListItem).ticket.id);
  const detailHref = (row: OrderListItem | AttendeeListItem) =>
    view === "orders"
      ? `/events/${eventId}/orders/${(row as OrderListItem).id}`
      : `/events/${eventId}/attendees/${(row as AttendeeListItem).id}`;

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(rowId(r)));
  const someSelected = rows.some((r) => selected.has(rowId(r)));

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      if (allSelected) rows.forEach((r) => next.delete(rowId(r)));
      else rows.forEach((r) => next.add(rowId(r)));
      return next;
    });
  }
  function toggleRow(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearFilters() {
    setOrderStatus(null);
    setFrom("");
    setTo("");
    setAdmissionStatus(null);
    setSource(null);
    setCheckedIn(null);
  }
  const hasFilters = view === "orders" ? Boolean(orderStatus || from || to) : Boolean(admissionStatus || source || checkedIn);

  function exportCsv(scope: "selected" | "all") {
    const params = new URLSearchParams(view === "orders" ? ordersParams : attendeesParams);
    params.delete("page");
    if (scope === "selected") {
      if (selected.size === 0) return;
      [...selected].forEach((id) => params.append("ids[]", String(id)));
    }
    triggerDownload(view === "orders" ? exportOrdersUrl(eventId, params) : exportAttendeesUrl(eventId, params));
    notifications.show({ color: "teal", message: "Your CSV download is starting." });
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap">
        <Group gap="md" wrap="wrap">
          <SegmentedControl
            value={view}
            onChange={(v) => {
              setView(v as View);
              setQ("");
              clearFilters();
            }}
            data={[
              { value: "orders", label: "Orders" },
              { value: "attendees", label: "Attendees" },
            ]}
          />
          <Text c="dimmed" size="sm">
            {total} {view === "orders" ? (total === 1 ? "order" : "orders") : total === 1 ? "attendee" : "attendees"}
          </Text>
        </Group>
        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Search"
            leftSection={<IconSearch size={16} />}
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            w={{ base: "100%", sm: 260 }}
          />
          <Popover position="bottom-end" withArrow shadow="md">
            <Popover.Target>
              <Button variant="default" leftSection={<IconAdjustmentsHorizontal size={16} />}>
                Filter
              </Button>
            </Popover.Target>
            <Popover.Dropdown>
              <Stack gap="sm" w={260}>
                {view === "orders" ? (
                  <>
                    <Select
                      label="Status"
                      clearable
                      value={orderStatus}
                      onChange={setOrderStatus}
                      data={Object.entries(ORDER_STATUS).map(([value, { label }]) => ({ value, label }))}
                    />
                    <TextInput type="date" label="From" value={from} onChange={(e) => setFrom(e.currentTarget.value)} />
                    <TextInput type="date" label="To" value={to} onChange={(e) => setTo(e.currentTarget.value)} />
                  </>
                ) : (
                  <>
                    <Select
                      label="Admission status"
                      clearable
                      value={admissionStatus}
                      onChange={setAdmissionStatus}
                      data={[
                        { value: "CONFIRMED", label: "Confirmed" },
                        { value: "PAYMENT_PENDING", label: "Payment pending" },
                        { value: "RESERVED", label: "Reserved" },
                      ]}
                    />
                    <Select
                      label="Source"
                      clearable
                      value={source}
                      onChange={setSource}
                      data={[
                        { value: "CHECKOUT", label: "Checkout" },
                        { value: "REGISTRATION", label: "Registration" },
                      ]}
                    />
                    <Select
                      label="Check-in"
                      clearable
                      value={checkedIn}
                      onChange={setCheckedIn}
                      data={[
                        { value: "1", label: "Checked in" },
                        { value: "0", label: "Not checked in" },
                      ]}
                    />
                  </>
                )}
                {hasFilters && (
                  <Button variant="subtle" size="xs" c="dimmed" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </Stack>
            </Popover.Dropdown>
          </Popover>
          <Button variant="default" onClick={() => exportCsv("all")}>
            Export
          </Button>
        </Group>
      </Group>

      {selected.size > 0 && (
        <Group gap="md" px="xs">
          <Text size="sm">{selected.size} selected</Text>
          <Button size="xs" variant="light" onClick={() => exportCsv("selected")}>
            Export selected
          </Button>
          <Button size="xs" variant="subtle" c="dimmed" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </Group>
      )}

      <Card withBorder radius="lg" p={0} style={{ overflow: "hidden" }}>
        <Table.ScrollContainer minWidth={880}>
          <Table highlightOnHover verticalSpacing={0} styles={tableStyles}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={44}>
                  <Checkbox
                    aria-label="Select all rows"
                    checked={allSelected}
                    indeterminate={!allSelected && someSelected}
                    onChange={toggleAll}
                  />
                </Table.Th>
                {view === "orders" ? (
                  <>
                    <Table.Th>Order ID</Table.Th>
                    <Table.Th>Buyer</Table.Th>
                    <Table.Th>Items</Table.Th>
                    <Table.Th>Attendees</Table.Th>
                    <Table.Th>Amount</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </>
                ) : (
                  <>
                    <Table.Th>Attendee</Table.Th>
                    <Table.Th>Ticket</Table.Th>
                    <Table.Th>Order</Table.Th>
                    <Table.Th>Source</Table.Th>
                    <Table.Th>Admission</Table.Th>
                    <Table.Th>Check-in</Table.Th>
                  </>
                )}
                <Table.Th w={56} ta="right">
                  Action
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => {
                const id = rowId(row);
                return (
                  <Table.Tr
                    key={id}
                    style={{ cursor: "pointer" }}
                    onClick={() => router.push(detailHref(row))}
                  >
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        aria-label="Select row"
                        checked={selected.has(id)}
                        onChange={() => toggleRow(id)}
                      />
                    </Table.Td>
                    {view === "orders"
                      ? (() => {
                          const o = row as OrderListItem;
                          const items = o.items_summary.map((i) => `${i.quantity}× ${i.name}`).join(" · ") || "—";
                          const status = ORDER_STATUS[o.status];
                          return (
                            <>
                              <Table.Td>
                                <Text fw={600} size="sm">
                                  #{o.short_id}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <TwoLine primary={`${o.first_name} ${o.last_name}`} secondary={o.email} />
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">{items}</Text>
                              </Table.Td>
                              <Table.Td>
                                <Stack gap={2}>
                                  <Text size="sm">
                                    {o.checked_in_count}/{o.tickets_count}
                                  </Text>
                                  {o.attendees_count < o.tickets_count && (
                                    <Text size="xs" c="dimmed">
                                      {o.tickets_count - o.attendees_count} unassigned
                                    </Text>
                                  )}
                                </Stack>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">{formatAmount(o.total_amount, o.currency)}</Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm" c="dimmed">
                                  {formatEventDate(o.created_at, timezone)}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <StatusLabel {...status} />
                              </Table.Td>
                            </>
                          );
                        })()
                      : (() => {
                          const a = row as AttendeeListItem;
                          const adm = ADMISSION_STATUS[a.admission_status];
                          return (
                            <>
                              <Table.Td>
                                <TwoLine primary={`${a.first_name} ${a.last_name}`} secondary={a.email} />
                              </Table.Td>
                              <Table.Td>
                                <TwoLine primary={a.ticket.name} secondary={a.ticket.reference} />
                              </Table.Td>
                              <Table.Td>
                                <TwoLine primary={`#${a.order.short_id}`} secondary={a.order.buyer_name} />
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">{a.admission_source === "REGISTRATION" ? "Registration" : "Checkout"}</Text>
                              </Table.Td>
                              <Table.Td>
                                <StatusLabel {...adm} />
                              </Table.Td>
                              <Table.Td>
                                {a.check_in_status === "CHECKED_IN" ? (
                                  <StatusLabel
                                    c="teal"
                                    label={
                                      a.checked_in_at
                                        ? `Checked in · ${new Date(a.checked_in_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                                        : "Checked in"
                                    }
                                  />
                                ) : (
                                  <Text size="sm" c="dimmed">
                                    Not checked in
                                  </Text>
                                )}
                              </Table.Td>
                            </>
                          );
                        })()}
                    <Table.Td ta="right" onClick={(e) => e.stopPropagation()}>
                      <Menu position="bottom-end" withArrow>
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray" aria-label="Row actions">
                            <IconDots size={18} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          {view === "orders" ? (
                            <>
                              <Menu.Item onClick={() => router.push(`/events/${eventId}/orders/${(row as OrderListItem).id}`)}>
                                View order
                              </Menu.Item>
                              <Menu.Item
                                onClick={() => {
                                  navigator.clipboard?.writeText((row as OrderListItem).short_id);
                                  notifications.show({ message: "Order ID copied." });
                                }}
                              >
                                Copy order ID
                              </Menu.Item>
                            </>
                          ) : (
                            <>
                              <Menu.Item onClick={() => router.push(`/events/${eventId}/attendees/${(row as AttendeeListItem).id}`)}>
                                View attendee
                              </Menu.Item>
                              <Menu.Item onClick={() => router.push(`/events/${eventId}/orders/${(row as AttendeeListItem).order.id}`)}>
                                View order
                              </Menu.Item>
                              <Menu.Item
                                onClick={() => {
                                  navigator.clipboard?.writeText((row as AttendeeListItem).ticket.reference);
                                  notifications.show({ message: "Ticket reference copied." });
                                }}
                              >
                                Copy ticket reference
                              </Menu.Item>
                            </>
                          )}
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        {!activeQuery.isLoading && rows.length === 0 && (
          <Box p="xl">
            <Text ta="center" c="dimmed">
              {view === "orders" ? "No orders match these filters." : "No attendees match these filters."}
            </Text>
          </Box>
        )}
      </Card>

      {lastPage > 1 && (
        <Group justify="flex-end">
          <Pagination total={lastPage} value={page} onChange={setPage} siblings={1} boundaries={1} color="blue" />
        </Group>
      )}
    </Stack>
  );
}
