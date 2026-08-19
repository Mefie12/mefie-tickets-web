"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Container, Group, Loader, Stack, Table, Text, Title } from "@mantine/core";
import type { ComplimentaryAllocation } from "@/lib/complimentaryApi";

async function load() { const r = await fetch("/api/distributor/allocations"); if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<{ allocations: ComplimentaryAllocation[] }>; }
export function DistributorPortal() {
  const query = useQuery({ queryKey: ["distributor-allocations"], queryFn: load, retry: false });
  return <Container size="lg" py="xl"><Stack gap="xl"><Group justify="space-between"><Stack gap={2}><Title order={2}>Distributor portal</Title><Text c="dimmed">Only your complimentary allocations and balances appear here.</Text></Stack><Button component={Link} href="/distributor/settings" variant="default">Account settings</Button></Group>
    {/* The (portal) layout now redirects an unauthenticated visitor
        server-side before this component ever mounts, so this is just a
        generic fallback for an unexpected fetch failure, not the primary
        "log in" path anymore. */}
    {query.isLoading && <Loader />}{query.isError && <Alert color="yellow">Something went wrong loading your allocations. Try refreshing the page.</Alert>}
    {query.data?.allocations.length === 0 && <Card withBorder><Text c="dimmed">You do not have any accepted allocations yet.</Text></Card>}
    {query.data?.allocations.map((allocation) => <Card key={allocation.id} withBorder radius="lg" p="lg"><Stack><Group justify="space-between"><Stack gap={0}><Title order={4}>{allocation.program?.event.title}</Title><Text size="sm" c="dimmed">{allocation.program?.event.organization.name}</Text></Stack><Badge color={allocation.status === "ACTIVE" ? "teal" : allocation.status === "SUSPENDED" ? "yellow" : "gray"}>{allocation.status}</Badge></Group><Table><Table.Thead><Table.Tr><Table.Th>Ticket</Table.Th><Table.Th>Allocated</Table.Th><Table.Th>Issued</Table.Th><Table.Th>Returned</Table.Th><Table.Th>Available</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{allocation.lines.map((line) => <Table.Tr key={line.id}><Table.Td>{line.product.title}</Table.Td><Table.Td>{line.quantity_allocated}</Table.Td><Table.Td>{line.quantity_issued}</Table.Td><Table.Td>{line.quantity_returned}</Table.Td><Table.Td>{line.quantity_available}</Table.Td></Table.Tr>)}</Table.Tbody></Table><Group justify="space-between"><Text size="xs" c="dimmed">Distribution deadline: {new Date(allocation.distribution_deadline_at).toLocaleString()}</Text><Button component={Link} href={`/distributor/allocations/${allocation.id}`} size="sm">Manage allocation</Button></Group></Stack></Card>)}
  </Stack></Container>;
}
