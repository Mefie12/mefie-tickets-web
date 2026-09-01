"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Group, Modal, Select, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconDoorEnter, IconPlus } from "@tabler/icons-react";
import type { Product } from "@/lib/productApi";
import {
  createGate, createLane, replaceGateRoutes,
  cancelRoutingChange, getRoutingChange, prepareRoutingChange, publishRoutingChange, retryRoutingChange,
  type EventGate, type GateConfiguration, type RoutingChangePublication,
} from "@/lib/gateRoutingApi";

export function GateRoutingManager({
  eventId, eventStatus, products, initial,
}: { eventId: number; eventStatus: string; products: Product[]; initial: GateConfiguration }) {
  const [gates, setGates] = useState(initial.gates);
  const [routes, setRoutes] = useState<Record<number, { gateId: number; laneId: number }>>(() => Object.fromEntries(
    initial.generation.routes.map((route) => [route.product_id, { gateId: route.event_gate_id, laneId: route.gate_lane_id }]),
  ));
  const [gateModal, setGateModal] = useState(false);
  const [laneGate, setLaneGate] = useState<EventGate | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmChange, setConfirmChange] = useState(false);
  const [publication, setPublication] = useState<RoutingChangePublication | null>(initial.publication ?? null);
  const structureEditable = eventStatus === "DRAFT" && initial.generation.status === "DRAFT";
  const routingEditable = structureEditable || eventStatus === "LIVE";
  const defaultGate = gates.find((gate) => gate.is_default)!;
  const gateOptions = useMemo(() => gates.map((gate) => ({ value: String(gate.id), label: gate.name })), [gates]);

  useEffect(() => {
    if (!publication || publication.status !== "PREPARING") return;
    const timer = window.setInterval(async () => {
      try { setPublication((await getRoutingChange(eventId, publication.id)).publication); } catch { /* keep current progress visible */ }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [eventId, publication]);

  async function addGate() {
    setBusy(true);
    try {
      const result = await createGate(eventId, name);
      setGates((current) => [...current, result.gate]);
      setName(""); setGateModal(false);
      notifications.show({ color: "teal", message: "Entrance created." });
    } catch (error) {
      notifications.show({ color: "red", message: error instanceof Error ? error.message : "Could not create entrance." });
    } finally { setBusy(false); }
  }

  async function addLane() {
    if (!laneGate) return;
    setBusy(true);
    try {
      const result = await createLane(eventId, laneGate.id, name, code);
      setGates((current) => current.map((gate) => gate.id === laneGate.id
        ? { ...gate, lanes: [...gate.lanes, result.lane] } : gate));
      setName(""); setCode(""); setLaneGate(null);
      notifications.show({ color: "teal", message: "Lane created." });
    } catch (error) {
      notifications.show({ color: "red", message: error instanceof Error ? error.message : "Could not create lane." });
    } finally { setBusy(false); }
  }

  async function saveRouting() {
    setBusy(true);
    try {
      const payload = products.map((product) => ({
        product_id: product.id,
        event_gate_id: routes[product.id]?.gateId ?? defaultGate.id,
        gate_lane_id: routes[product.id]?.laneId ?? defaultGate.lanes[0]?.id,
      }));
      if (!structureEditable) {
        const result = await prepareRoutingChange(eventId, payload.map((route) => ({ ...route, gate_lane_id: route.gate_lane_id! })));
        setPublication(result.publication);
        setConfirmChange(false);
        notifications.show({ color: "blue", message: "Replacement credentials are being prepared. Current routing remains active." });
        return;
      }
      const result = await replaceGateRoutes(eventId, payload);
      setRoutes(Object.fromEntries(result.generation.routes.map((route) => [
        route.product_id,
        { gateId: route.event_gate_id, laneId: route.gate_lane_id },
      ])));
      notifications.show({ color: "teal", message: "Gate routing saved." });
    } catch (error) {
      notifications.show({ color: "red", message: error instanceof Error ? error.message : "Could not save routing." });
    } finally { setBusy(false); }
  }

  async function publishPreparedChange() {
    if (!publication) return;
    setBusy(true);
    try {
      const result = await publishRoutingChange(eventId, publication.id);
      setPublication(result.publication);
      setRoutes(Object.fromEntries(result.publication.generation.routes.map((route) => [route.product_id, {
        gateId: route.event_gate_id, laneId: route.gate_lane_id,
      }])));
      notifications.show({ color: "teal", message: "New routing published. Replacement tickets are queued for delivery." });
    } catch (error) {
      notifications.show({ color: "red", message: error instanceof Error ? error.message : "Could not publish routing." });
    } finally { setBusy(false); }
  }

  async function retryPreparation() {
    if (!publication) return;
    setBusy(true);
    try { setPublication((await retryRoutingChange(eventId, publication.id)).publication); }
    catch (error) { notifications.show({ color: "red", message: error instanceof Error ? error.message : "Could not retry preparation." }); }
    finally { setBusy(false); }
  }

  async function cancelPreparation() {
    if (!publication || !window.confirm("Cancel this staged routing change? Current published routing will remain unchanged.")) return;
    setBusy(true);
    try {
      await cancelRoutingChange(eventId, publication.id);
      setPublication(null);
      notifications.show({ message: "Staged routing change cancelled. Current routing was not changed." });
    } catch (error) { notifications.show({ color: "red", message: error instanceof Error ? error.message : "Could not cancel routing change." }); }
    finally { setBusy(false); }
  }

  return <Stack gap="xl" maw={1000}>
    <Group justify="space-between" align="flex-start">
      <Stack gap={2}><Title order={2}>Entrances & lanes</Title><Text c="dimmed">
        Tickets show their entrance. Lanes remain operational and can change without reissuing tickets.
      </Text></Stack>
      <Button leftSection={<IconPlus size={16}/>} disabled={!structureEditable} onClick={() => { setName(""); setGateModal(true); }}>
        Add entrance
      </Button>
    </Group>
    {!structureEditable && <Card withBorder bg="blue.0"><Stack gap={4}><Text fw={600}>Published routing change</Text><Text size="sm">
      Gate changes are staged first. Current tickets remain valid until every affected replacement is generated and you explicitly publish. Changes are blocked after scanner preparation or admission activity begins.
    </Text></Stack></Card>}
    {publication && <Card withBorder bg={publication.status === "FAILED" ? "red.0" : publication.status === "READY" ? "green.0" : "gray.0"}><Stack gap="xs">
      <Group justify="space-between"><Text fw={700}>Routing generation {publication.generation.version}</Text><Badge>{publication.status}</Badge></Group>
      <Text size="sm">Replacement tickets prepared: {publication.prepared_credentials} / {publication.affected_credentials}</Text>
      {publication.failed_credentials > 0 && <Text size="sm" c="red">{publication.failed_credentials} ticket artifacts failed to generate.</Text>}
      <Group justify="flex-end">{["PREPARING", "READY", "FAILED"].includes(publication.status) && <Button variant="subtle" color="gray" onClick={cancelPreparation} disabled={busy}>Cancel proposal</Button>}
        {publication.status === "FAILED" && <Button variant="light" onClick={retryPreparation} loading={busy}>Retry failed artifacts</Button>}
        {publication.status === "READY" && <Button color="orange" onClick={publishPreparedChange} loading={busy}>Publish routing and deliver tickets</Button>}</Group>
    </Stack></Card>}
    <SimpleGrid cols={{ base: 1, md: 2 }}>
      {gates.map((gate) => <Card key={gate.id} withBorder radius="lg">
        <Stack gap="sm"><Group justify="space-between"><Group gap="xs"><IconDoorEnter size={20}/><Text fw={700}>{gate.name}</Text></Group>
          {gate.is_default && <Badge variant="light">Default</Badge>}</Group>
          <Stack gap={4}>{gate.lanes.map((lane) => <Text key={lane.id} size="sm">{lane.name} <Text span c="dimmed">({lane.code})</Text></Text>)}</Stack>
          <Button variant="subtle" size="xs" disabled={!structureEditable} onClick={() => { setName(""); setCode(""); setLaneGate(gate); }}>Add lane</Button>
        </Stack>
      </Card>)}
    </SimpleGrid>
    <Card withBorder radius="lg"><Stack>
      <Stack gap={2}><Text fw={700}>Ticket routing</Text><Text size="sm" c="dimmed">
        Unassigned ticket types use {defaultGate.name}. The entrance—not the lane—is printed and signed into each ticket.
      </Text></Stack>
      {products.map((product) => {
        const route = routes[product.id] ?? { gateId: defaultGate.id, laneId: defaultGate.lanes[0]?.id };
        const routeGate = gates.find((gate) => gate.id === route.gateId) ?? defaultGate;
        return <SimpleGrid key={product.id} cols={{ base: 1, sm: 2 }}>
          <Select label={`${product.title} · entrance`} data={gateOptions}
            disabled={!routingEditable || (publication !== null && publication.status !== "PUBLISHED")} value={String(routeGate.id)}
            onChange={(value) => {
              if (!value) return;
              const gate = gates.find((item) => item.id === Number(value));
              if (!gate?.lanes[0]) return;
              setRoutes((current) => ({ ...current, [product.id]: { gateId: gate.id, laneId: gate.lanes[0].id } }));
            }}/>
          <Select label={`${product.title} · lane`}
            data={routeGate.lanes.map((lane) => ({ value: String(lane.id), label: lane.name }))}
            disabled={!routingEditable || (publication !== null && publication.status !== "PUBLISHED")} value={route.laneId ? String(route.laneId) : null}
            onChange={(value) => value && setRoutes((current) => ({
              ...current,
              [product.id]: { gateId: routeGate.id, laneId: Number(value) },
            }))}/>
        </SimpleGrid>;
      })}
      <Group justify="flex-end"><Button disabled={!routingEditable || (publication !== null && publication.status !== "PUBLISHED")} loading={busy}
        onClick={() => structureEditable ? saveRouting() : setConfirmChange(true)}>{structureEditable ? "Save routing" : "Prepare routing change"}</Button></Group>
    </Stack></Card>
    <Modal opened={gateModal} onClose={() => setGateModal(false)} title="New entrance" centered>
      <Stack><TextInput label="Entrance name" value={name} onChange={(e) => setName(e.currentTarget.value)} autoFocus/>
        <Button loading={busy} disabled={!name.trim()} onClick={addGate}>Create entrance</Button></Stack>
    </Modal>
    <Modal opened={confirmChange} onClose={() => setConfirmChange(false)} title="Prepare published routing change" centered>
      <Stack><Text size="sm">Mefie will generate every affected replacement ticket before changing canonical routing. Existing tickets remain valid during preparation.</Text>
        <Text size="sm" fw={600}>This workflow is unavailable after scanners have been prepared or admission has started.</Text>
        <Group justify="flex-end"><Button variant="default" onClick={() => setConfirmChange(false)}>Cancel</Button>
          <Button color="orange" loading={busy} onClick={saveRouting}>Prepare replacements</Button></Group>
      </Stack>
    </Modal>
    <Modal opened={laneGate !== null} onClose={() => setLaneGate(null)} title={`New lane · ${laneGate?.name ?? ""}`} centered>
      <Stack><TextInput label="Lane name" value={name} onChange={(e) => setName(e.currentTarget.value)} autoFocus/>
        <TextInput label="Lane code" description="Short operational identifier, for example vip-1" value={code} onChange={(e) => setCode(e.currentTarget.value)}/>
        <Button loading={busy} disabled={!name.trim() || !code.trim()} onClick={addLane}>Create lane</Button></Stack>
    </Modal>
  </Stack>;
}
