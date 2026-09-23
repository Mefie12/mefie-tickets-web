"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { Alert, Button, Card, Group, Pagination, ScrollArea, SegmentedControl, Select, Stack, Table, Text, TextInput } from "@mantine/core";
import { IconDownload, IconSearch } from "@tabler/icons-react";
import { listProducts } from "@/lib/productApi";

type Kind = "orders" | "attendees";
type Answer = { text: string; submitter_label: string; recorded_at: string | null; question_title_at_answer: string | null; question_title: string };
type Row = { id: number; reference: string; order_reference: string; buyer_name: string; buyer_email: string; attendee_name: string | null; attendee_id: number | null; ticket_name: string | null; status: string; answers: Record<number, Answer> };
type Payload = { questions: { id: number; title: string; type: string; is_sensitive: boolean }[]; rows: Row[]; meta: { current_page: number; last_page: number; total: number } };

export function QuestionResponses({ eventId }: { eventId: number }) {
  const [kind, setKind] = useState<Kind>("orders");
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [status, setStatus] = useState<string | null>(null);
  const [product, setProduct] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page) });
    if (debouncedSearch.trim()) p.set("q", debouncedSearch.trim());
    if (status) p.set("status", status);
    if (product) p.set("product_id", product);
    return p;
  }, [page, debouncedSearch, status, product]);
  const report = useQuery({ queryKey: ["question-responses", eventId, kind, params.toString()], queryFn: async () => {
    const res = await fetch(`/api/events/${eventId}/responses/${kind}?${params}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Unable to load responses.");
    return res.json() as Promise<Payload>;
  } });
  const products = useQuery({ queryKey: ["products", eventId], queryFn: () => listProducts(eventId) });
  const data = report.data;
  const downloadParams = new URLSearchParams(params);
  downloadParams.delete("page");

  return <Stack gap="md">
    <Text c="dimmed">Current order and ticket answers for this event. “For attendee” identifies the subject; “Recorded by” identifies the submitter when known.</Text>
    <Group justify="space-between" align="end">
      <SegmentedControl value={kind} onChange={(value) => { setKind(value as Kind); setPage(1); }} data={[{ label: "Order responses", value: "orders" }, { label: "Attendee responses", value: "attendees" }]} />
      <Button component="a" href={`/api/events/${eventId}/responses/${kind}/export?${downloadParams}`} leftSection={<IconDownload size={16} />} disabled={!data}>Download filtered CSV</Button>
    </Group>
    <Alert color="blue" title="Sensitive information">Downloads include all recorded answers, including sensitive responses. Store and share them carefully.</Alert>
    <Group align="end">
      <TextInput label="Search" placeholder={kind === "orders" ? "Order, buyer or email" : "Order or attendee"} leftSection={<IconSearch size={15} />} value={search} onChange={(e) => { setSearch(e.currentTarget.value); setPage(1); }} />
      <Select label="Order status" placeholder="All statuses" clearable value={status} onChange={(v) => { setStatus(v); setPage(1); }} data={["RESERVED", "COMPLETED", "AWAITING_OFFLINE_PAYMENT", "CANCELLED", "ABANDONED"].map((value) => ({ value, label: value.replaceAll("_", " ") }))} />
      <Select label="Ticket type" placeholder="All tickets" clearable searchable value={product} onChange={(v) => { setProduct(v); setPage(1); }} data={(products.data?.products ?? []).map((p) => ({ value: String(p.id), label: p.title }))} />
    </Group>
    {report.isError && <Alert color="red">Unable to load responses. Please try again.</Alert>}
    <Card withBorder radius="lg" p={0}>
      <ScrollArea>
        <Table striped highlightOnHover withTableBorder miw={Math.max(850, 520 + (data?.questions.length ?? 0) * 210)}>
          <Table.Thead><Table.Tr>
            <Table.Th>{kind === "orders" ? "Order" : "Ticket"}</Table.Th>
            <Table.Th>{kind === "orders" ? "Buyer" : "Current attendee"}</Table.Th>
            {kind === "attendees" && <><Table.Th>Order / buyer</Table.Th><Table.Th>Ticket type</Table.Th></>}
            <Table.Th>Status</Table.Th>
            {data?.questions.map((q) => <Table.Th key={q.id}>{q.title} <Text component="span" size="xs" c="dimmed">[q{q.id}]</Text></Table.Th>)}
          </Table.Tr></Table.Thead>
          <Table.Tbody>{data?.rows.map((row) => <Table.Tr key={row.id}>
            <Table.Td>{kind === "orders" ? <Link href={`/events/${eventId}/orders/${row.id}`}>{row.reference}</Link> : row.reference}</Table.Td>
            <Table.Td>{kind === "orders" ? <><Text size="sm">{row.buyer_name}</Text><Text size="xs" c="dimmed">{row.buyer_email}</Text></> : row.attendee_id ? <Link href={`/events/${eventId}/attendees/${row.attendee_id}`}>{row.attendee_name}</Link> : "Not assigned"}</Table.Td>
            {kind === "attendees" && <><Table.Td>{row.order_reference} · {row.buyer_name}</Table.Td><Table.Td>{row.ticket_name}</Table.Td></>}
            <Table.Td>{row.status.replaceAll("_", " ")}</Table.Td>
            {data.questions.map((q) => { const answer = row.answers[q.id]; return <Table.Td key={q.id}>{answer ? <Stack gap={2}><Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{answer.text}</Text><Text size="xs" c="dimmed">Recorded by: {answer.submitter_label}{answer.recorded_at ? ` · ${new Date(answer.recorded_at).toLocaleString()}` : ""}</Text>{answer.question_title_at_answer && answer.question_title_at_answer !== q.title && <Text size="xs" c="dimmed">Asked as: {answer.question_title_at_answer}</Text>}</Stack> : <Text size="sm" c="dimmed">—</Text>}</Table.Td>; })}
          </Table.Tr>)}</Table.Tbody>
        </Table>
      </ScrollArea>
      {report.isLoading && <Text p="md">Loading responses…</Text>}
      {data && data.rows.length === 0 && <Text p="md" c="dimmed">No matching responses.</Text>}
    </Card>
    {data && data.meta.last_page > 1 && <Group justify="flex-end"><Pagination value={page} onChange={setPage} total={data.meta.last_page} /></Group>}
  </Stack>;
}
