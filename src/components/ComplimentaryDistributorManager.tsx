"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Accordion, Alert, Badge, Button, Group, Modal, NumberInput, SimpleGrid, Stack, Table, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconMailForward, IconPlus, IconUserShare } from "@tabler/icons-react";
import { isValidPhoneNumber } from "libphonenumber-js";
import { createComplimentaryAllocation, listComplimentaryAllocations, manageComplimentaryAllocation, type ComplimentaryProgram } from "@/lib/complimentaryApi";
import type { Product } from "@/lib/productApi";
import { PhoneInput } from "@/components/PhoneInput";
import { complimentaryInventory, poolLineKey } from "@/lib/complimentaryInventory";

type Action = "resend" | "revoke" | "suspend" | "resume" | "close";

export function ComplimentaryDistributorManager({ eventId, program, products, onProgramChange }: { eventId: number; program: ComplimentaryProgram; products: Product[]; onProgramChange: () => void }) {
  const cache = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState(""); const [company, setCompany] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const inventory = complimentaryInventory(products);
  const poolByItem = new Map(program.pool_lines.map((line) => [poolLineKey(line), line]));
  // Mantine's NumberInput silently snaps an over-max value down to max on
  // blur (e.g. when the Create button is clicked) with no visible diff —
  // confirmed live: a typo here silently allocated far more than intended.
  // Block submission instead of trusting the clamp to save anyone.
  const overAllocated = inventory.some((item) => (quantities[item.key] ?? 0) > (poolByItem.get(item.key)?.quantity_available ?? 0));
  const queryKey = ["complimentary-allocations", eventId];
  const allocations = useQuery({ queryKey, queryFn: () => listComplimentaryAllocations(eventId) });
  const refresh = () => cache.invalidateQueries({ queryKey });
  const create = useMutation({
    mutationFn: () => createComplimentaryAllocation(eventId, { name: name.trim(), email: email.trim(), phone: phone || null, company: company.trim() || null, lines: inventory.map((item) => ({ product_id: item.productId, product_price_tier_id: item.optionId, quantity: quantities[item.key] ?? 0 })).filter((line) => line.quantity > 0) }),
    onSuccess: () => { notifications.show({ color: "teal", message: "Allocation created and invitation queued." }); setOpened(false); setName(""); setEmail(""); setPhone(""); setCompany(""); setQuantities({}); refresh(); onProgramChange(); },
    onError: () => notifications.show({ color: "red", message: "Could not create this allocation." }),
  });
  const manage = useMutation({
    mutationFn: ({ id, action }: { id: number; action: Action }) => manageComplimentaryAllocation(eventId, id, action),
    onSuccess: (_, values) => { notifications.show({ color: "teal", message: values.action === "resend" ? "Invitation resent." : "Allocation updated." }); refresh(); onProgramChange(); },
    onError: () => notifications.show({ color: "red", message: "Could not update this allocation." }),
  });
  function submit() {
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email)) return notifications.show({ color: "red", message: "Enter a name and valid email." });
    if (phone && !isValidPhoneNumber(phone)) return notifications.show({ color: "red", message: "Enter a valid phone number or leave it blank." });
    if (!Object.values(quantities).some((value) => value > 0)) return notifications.show({ color: "red", message: "Allocate at least one ticket." });
    if (overAllocated) return notifications.show({ color: "red", message: "Reduce quantities that exceed the available complimentary balance." });
    create.mutate();
  }

  return <Stack gap="lg">
    <Group justify="space-between"><Stack gap={2}><Group><IconUserShare size={20} /><Text fw={700}>Distributors</Text></Group><Text size="sm" c="dimmed">Move pool balance to a partner without creating attendee tickets yet.</Text></Stack><Button leftSection={<IconPlus size={16} />} disabled={program.status !== "ACTIVE"} onClick={() => setOpened(true)}>Add distributor</Button></Group>
    {program.status !== "ACTIVE" && <Alert color="blue">Pending invitations may still be resent and accepted, but distributors cannot issue tickets until complimentary ticketing is re-enabled.</Alert>}
    {allocations.isLoading && <Text size="sm" c="dimmed">Loading allocations…</Text>}
    {allocations.data?.length ? <Accordion variant="separated">{allocations.data.map((allocation) => <Accordion.Item key={allocation.id} value={String(allocation.id)}><Accordion.Control><Group justify="space-between" pr="md"><Stack gap={0}><Text fw={600}>{allocation.distributor.name}{allocation.distributor.company ? ` · ${allocation.distributor.company}` : ""}</Text><Text size="xs" c="dimmed">{allocation.distributor.email}</Text></Stack><Badge color={statusColor(allocation.status)}>{allocation.status}</Badge></Group></Accordion.Control><Accordion.Panel><Stack>
      <Table><Table.Thead><Table.Tr><Table.Th>Ticket</Table.Th><Table.Th>Allocated</Table.Th><Table.Th>Issued</Table.Th><Table.Th>Returned</Table.Th><Table.Th>Available</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{allocation.lines.map((line) => <Table.Tr key={line.id}><Table.Td>{line.product.title}{line.price_tier ? ` — ${line.price_tier.name}` : ""}</Table.Td><Table.Td>{line.quantity_allocated}</Table.Td><Table.Td>{line.quantity_issued}</Table.Td><Table.Td>{line.quantity_returned}</Table.Td><Table.Td>{line.quantity_available}</Table.Td></Table.Tr>)}</Table.Tbody></Table>
      <Text size="xs" c="dimmed">Deadline: {new Date(allocation.distribution_deadline_at).toLocaleString()}</Text><Group justify="flex-end">{allocation.status === "PENDING" && <><Button size="xs" variant="light" leftSection={<IconMailForward size={14} />} onClick={() => manage.mutate({ id: allocation.id, action: "resend" })}>Resend</Button><Button size="xs" variant="light" color="red" onClick={() => manage.mutate({ id: allocation.id, action: "revoke" })}>Revoke</Button></>}{allocation.status === "ACTIVE" && <><Button size="xs" variant="light" color="yellow" onClick={() => manage.mutate({ id: allocation.id, action: "suspend" })}>Suspend</Button><Button size="xs" variant="light" color="red" onClick={() => manage.mutate({ id: allocation.id, action: "close" })}>Close & return unused</Button></>}{allocation.status === "SUSPENDED" && <><Button size="xs" variant="light" onClick={() => manage.mutate({ id: allocation.id, action: "resume" })}>Resume</Button><Button size="xs" variant="light" color="red" onClick={() => manage.mutate({ id: allocation.id, action: "close" })}>Close & return unused</Button></>}</Group>
    </Stack></Accordion.Panel></Accordion.Item>)}</Accordion> : !allocations.isLoading && <Text size="sm" c="dimmed">No distributor allocations yet.</Text>}
    <Modal opened={opened} onClose={() => setOpened(false)} title="Add complimentary distributor" size="lg"><Stack><SimpleGrid cols={{ base: 1, sm: 2 }}><TextInput required label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} /><TextInput required type="email" label="Email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} /><PhoneInput label="Phone (optional)" value={phone} onChange={setPhone} /><TextInput label="Company (optional)" value={company} onChange={(e) => setCompany(e.currentTarget.value)} /></SimpleGrid><Text fw={600}>Ticket allocation</Text>{inventory.map((item) => { const line = poolByItem.get(item.key); const paused = item.product.disabled_at || item.option?.disabled_at; const available = line?.quantity_available ?? 0; const quantity = quantities[item.key] ?? 0; return <Group key={item.key} justify="space-between" align="flex-start"><Stack gap={0}><Group gap="xs"><Text>{item.label}</Text>{paused && <Badge color="gray" variant="light">Public sales paused</Badge>}</Group><Text size="xs" c="dimmed">{available} unallocated complimentary tickets</Text></Stack><NumberInput aria-label={`${item.label} allocation`} min={0} max={available} clampBehavior="blur" error={quantity > available ? `Exceeds available balance (${available})` : undefined} value={quantity} onChange={(value) => setQuantities((current) => ({ ...current, [item.key]: Number(value) || 0 }))} /></Group>; })}<Group justify="flex-end"><Button variant="default" onClick={() => setOpened(false)}>Cancel</Button><Button loading={create.isPending} disabled={overAllocated} onClick={submit}>Create & send invitation</Button></Group></Stack></Modal>
  </Stack>;
}

function statusColor(status: string) { return status === "ACTIVE" ? "teal" : status === "PENDING" ? "blue" : status === "SUSPENDED" ? "yellow" : "gray"; }
