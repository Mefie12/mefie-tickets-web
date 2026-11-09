"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useElementSize } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  ActionIcon, Badge, Box, Button, Card, Drawer, Group, Menu, Modal, Paper, Stack, Switch, Text, TextInput, Tooltip,
} from "@mantine/core";
import {
  IconArrowDown, IconArrowUp, IconArrowsMove, IconEye, IconFolderPlus, IconGripVertical, IconPencil, IconTrash,
} from "@tabler/icons-react";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TicketSelector } from "@/components/TicketSelector";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import type { Bundle, Product } from "@/lib/productApi";
import {
  applyTicketLayoutToOccurrences, createTicketSection, deleteTicketSection, getTicketLayout, LayoutConflictError,
  saveTicketLayout, updateTicketSection, type BuyerView, type TicketLayoutResponse,
} from "@/lib/ticketLayoutApi";
import {
  buyerLayoutFrom, indentUnderSection, moveBy, moveToSection, nodeKey, reorderTo, type LayoutItemRef, type LayoutNode, type LayoutSectionNode,
} from "@/lib/ticketLayout";

type Props = {
  eventId: number;
  currencyCode: string;
  disabled: boolean;
  products: Product[];
  bundles: Bundle[];
  renderProduct: (product: Product) => ReactNode;
  renderBundle: (bundle: Bundle) => ReactNode;
  /** Set on a series template: shows "Apply to upcoming occurrences". */
  seriesId?: number;
};

const sameKeys = (a: LayoutNode[], b: LayoutNode[]) => {
  const flat = (nodes: LayoutNode[]) => nodes.flatMap((n) => (n.type === "section" ? [nodeKey(n), ...n.items.map((i) => `${i.kind}:${i.id}`)] : [nodeKey(n)])).sort();
  return JSON.stringify(flat(a)) === JSON.stringify(flat(b));
};

/**
 * One list for tickets, ticket groups and bundles, in the order buyers see them, optionally
 * under heading-only sections, beside a live "what buyers see" preview. Moves save as you go
 * (optimistic, one request in flight, latest wins) with an Undo; if the list changed elsewhere
 * the server says so (409) and the editor reloads the fresh order instead of overwriting it.
 */
export function TicketArranger({ eventId, currencyCode, disabled, products, bundles, renderProduct, renderBundle, seriesId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  // Side-by-side only when the editor itself is wide: the page has sidebars, so the window width is no guide.
  const { ref: containerRef, width: containerWidth } = useElementSize();
  const wide = containerWidth >= 900;
  // Narrow editor (a phone, or a tablet with sidebars): controls move to a slim bar above each card.
  const compact = containerWidth > 0 && containerWidth < 600;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const queryKey = ["ticket-layout", eventId];
  const layoutQuery = useQuery({ queryKey, queryFn: () => getTicketLayout(eventId) });

  const [nodes, setNodes] = useState<LayoutNode[]>([]);
  const [buyerView, setBuyerView] = useState<BuyerView | null>(null);
  const [sectionModal, setSectionModal] = useState<LayoutSectionNode | "new" | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const revision = useRef("");
  const baseline = useRef<LayoutNode[]>([]); // last order the server confirmed
  const burstStart = useRef<LayoutNode[]>([]); // order before the current run of moves (for Undo)
  const pending = useRef<LayoutNode[] | null>(null);
  const inflight = useRef(false);

  const adopt = (res: Pick<TicketLayoutResponse, "revision" | "nodes"> & { buyer_view?: BuyerView }) => {
    revision.current = res.revision;
    baseline.current = res.nodes;
    setNodes(res.nodes);
    if (res.buyer_view) setBuyerView(res.buyer_view);
  };

  // Follow the server whenever nothing of ours is mid-save (first load, a ticket added or removed elsewhere).
  useEffect(() => {
    const data = layoutQuery.data;
    if (data && !inflight.current && !pending.current) adopt(data);
  }, [layoutQuery.data]);

  const onFailure = (error: unknown) => {
    pending.current = null;
    if (error instanceof LayoutConflictError) {
      if (error.layout) adopt(error.layout);
      queryClient.invalidateQueries({ queryKey });
      notifications.show({ color: "yellow", message: "The ticket list changed elsewhere, so it was reloaded. Your last move was not saved." });
      return;
    }
    if (redirectOnAuthError(error as Error, router)) return;
    setNodes(baseline.current);
    notifications.show({ color: "red", message: error instanceof ApiError ? error.message : "Could not save the order." });
  };

  async function flush(offerUndo: boolean) {
    if (inflight.current) return;
    let saved = false;
    while (pending.current) {
      const next = pending.current;
      pending.current = null;
      inflight.current = true;
      try {
        const res = await saveTicketLayout(eventId, revision.current, next);
        revision.current = res.revision;
        baseline.current = res.nodes;
        setBuyerView(res.buyer_view);
        if (!pending.current) setNodes(res.nodes);
        saved = true;
      } catch (error) {
        onFailure(error);
        saved = false;
      } finally {
        inflight.current = false;
      }
    }
    if (saved && offerUndo) {
      notifications.show({
        id: "ticket-layout-undo",
        color: "teal",
        autoClose: 6000,
        message: (
          <Group gap="xs" justify="space-between" wrap="nowrap">
            <Text size="sm">Order saved.</Text>
            <Button size="compact-xs" variant="light" onClick={undo}>Undo</Button>
          </Group>
        ),
      });
    }
  }

  function commit(next: LayoutNode[], offerUndo = true) {
    if (!inflight.current && !pending.current) burstStart.current = baseline.current;
    setNodes(next);
    pending.current = next;
    void flush(offerUndo);
  }

  function undo() {
    notifications.hide("ticket-layout-undo");
    if (!sameKeys(burstStart.current, baseline.current)) {
      notifications.show({ color: "yellow", message: "Tickets were added or removed since, so that move can't be undone." });
      return;
    }
    commit(burstStart.current, false);
  }

  /** Section create/rename/delete: the server answers with the fresh layout. */
  async function runSection(action: () => Promise<TicketLayoutResponse>) {
    try {
      adopt(await action());
    } catch (error) {
      onFailure(error);
    }
  }

  const productById = new Map(products.map((p) => [p.id, p]));
  const bundleById = new Map(bundles.map((b) => [b.id, b]));
  const shown = (item: LayoutItemRef) =>
    buyerView === null || (item.kind === "product" ? buyerView.products.some((p) => p.id === item.id) : buyerView.bundles.some((b) => b.id === item.id));

  function hiddenReason(item: LayoutItemRef): string | null {
    if (shown(item)) return null;
    if (item.kind === "bundle") return bundleById.get(item.id)?.is_enabled === false ? "Paused" : "Hidden";
    const product = productById.get(item.id);
    if (!product) return null;
    if (product.disabled_at) return "Paused";
    if (product.bundle_only || (product.type === "TIERED" && product.price_tiers.length > 0 && product.price_tiers.every((t) => t.bundle_only))) return "Only sold in bundles";
    return "Hidden";
  }

  function renderItem(item: LayoutItemRef) {
    const body = item.kind === "product" ? (productById.get(item.id) ? renderProduct(productById.get(item.id)!) : null) : (bundleById.get(item.id) ? renderBundle(bundleById.get(item.id)!) : null);
    if (body === null) return null;
    const reason = hiddenReason(item);
    return (
      <Stack gap={4}>
        {body}
        {reason && <Text size="xs" c="orange.8">Not shown to buyers: {reason}.</Text>}
      </Stack>
    );
  }

  const sectionsList = nodes.filter((n): n is LayoutSectionNode => n.type === "section");

  // WordPress-menu style: slide a ticket right to nest it under the section directly above, left to pull it out.
  // A mostly-sideways drag is only ever a slide (never a reorder), so a little vertical drift of the hand can't
  // turn it into a move over a neighbouring card.
  const INDENT_PX = 28;
  function onDragEnd(event: DragEndEvent) {
    const { active, over, delta } = event;
    const key = String(active.id);
    const sideways = Math.abs(delta.x) > INDENT_PX && Math.abs(delta.x) > Math.abs(delta.y);
    let next = nodes;
    if (sideways && delta.x > 0) {
      next = indentUnderSection(nodes, key);
      if (next === nodes && !key.startsWith("section:")) {
        notifications.show({ id: "ticket-indent-hint", color: "yellow", message: "To slide a ticket into a section, first put it directly below that section." });
      }
    } else if (sideways) {
      next = moveToSection(nodes, key, null);
    } else if (over && active.id !== over.id) {
      next = reorderTo(nodes, key, String(over.id));
    }
    if (next !== nodes) commit(next);
  }

  function confirmDeleteSection(section: LayoutSectionNode) {
    modals.openConfirmModal({
      title: `Delete section "${section.title}"?`,
      centered: true,
      children: <Text size="sm">Its tickets are kept and stay in the same place in the list; only the heading goes.</Text>,
      labels: { confirm: "Delete section", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => runSection(() => deleteTicketSection(eventId, section.id, revision.current)),
    });
  }

  function confirmApplyToOccurrences() {
    modals.openConfirmModal({
      title: "Apply this order to upcoming occurrences?",
      centered: true,
      children: <Text size="sm">Every upcoming occurrence (today onward, including one already under way) will show tickets in this order and under these sections. This changes only how tickets are listed, not prices or stock.</Text>,
      labels: { confirm: "Apply", cancel: "Cancel" },
      onConfirm: async () => {
        try {
          const { applied } = await applyTicketLayoutToOccurrences(seriesId!);
          notifications.show({ color: "teal", message: `Applied to ${applied} upcoming ${applied === 1 ? "occurrence" : "occurrences"}.` });
        } catch (error) {
          if (!redirectOnAuthError(error as Error, router)) notifications.show({ color: "red", message: error instanceof ApiError ? error.message : "Something went wrong." });
        }
      },
    });
  }

  const list = (
    <Stack gap="sm">
      <Group justify="space-between" gap="xs">
        <Text size="sm" c="dimmed">Drag to set the order buyers see; drag a ticket right under a section to put it inside, left to take it out. Sections are just headings.</Text>
        {!wide && (
          <Button size="xs" variant="light" leftSection={<IconEye size={14} />} onClick={() => setPreviewOpen(true)}>Preview</Button>
        )}
        {!disabled && (
          <Group gap="xs">
            <Button size="xs" variant="light" leftSection={<IconFolderPlus size={14} />} onClick={() => setSectionModal("new")}>Add section</Button>
            {seriesId !== undefined && <Button size="xs" variant="light" onClick={confirmApplyToOccurrences}>Apply to upcoming occurrences</Button>}
          </Group>
        )}
      </Group>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={nodes.map(nodeKey)} strategy={verticalListSortingStrategy}>
          <Stack gap="sm">
            {nodes.map((node, index) => {
              if (node.type === "item") {
                const content = renderItem(node);
                if (content === null) return null;
                return (
                  <SortableRow key={nodeKey(node)} id={nodeKey(node)} compact={compact} disabled={disabled} canUp={index > 0} canDown={index < nodes.length - 1}
                    onMove={(delta) => commit(moveBy(nodes, nodeKey(node), delta))}
                    moveTargets={sectionsList} currentSection={null} onMoveTo={(sectionId) => commit(moveToSection(nodes, nodeKey(node), sectionId))}>
                    {content}
                  </SortableRow>
                );
              }
              return (
                <SortableRow key={nodeKey(node)} id={nodeKey(node)} compact={compact} disabled={disabled} canUp={index > 0} canDown={index < nodes.length - 1}
                  onMove={(delta) => commit(moveBy(nodes, nodeKey(node), delta))}>
                  <Card withBorder radius="lg" p={compact ? "xs" : "md"} bg="var(--mantine-color-default-hover)">
                    <Stack gap="sm">
                      <Group justify="space-between" wrap="nowrap" align="flex-start">
                        <Stack gap={0} style={{ minWidth: 0 }}>
                          <Group gap="xs">
                            <Text fw={700}>{node.title}</Text>
                            <Badge size="sm" variant="outline" color="gray">Section</Badge>
                            {node.collapsed_by_default && <Badge size="sm" variant="light" color="gray">Starts collapsed</Badge>}
                          </Group>
                          {node.description && <Text size="sm" c="dimmed">{node.description}</Text>}
                        </Stack>
                        {!disabled && (
                          <Group gap="xs" wrap="nowrap">
                            <Tooltip label="Edit section"><ActionIcon variant="light" color="gray" size="lg" aria-label="Edit section" onClick={() => setSectionModal(node)}><IconPencil size={16} /></ActionIcon></Tooltip>
                            <Tooltip label="Delete section (keeps its tickets)"><ActionIcon variant="light" color="red" size="lg" aria-label="Delete section" onClick={() => confirmDeleteSection(node)}><IconTrash size={16} /></ActionIcon></Tooltip>
                          </Group>
                        )}
                      </Group>
                      {node.items.length === 0 ? (
                        <Text size="sm" c="dimmed" ta="center" py="sm">Empty. Use the move button on a ticket to put it here. Empty sections are hidden from buyers.</Text>
                      ) : (
                        <Box pl={compact ? 8 : "md"} ml={compact ? 2 : "xs"} style={{ borderLeft: "2px solid var(--mantine-color-default-border)" }}>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                          <SortableContext items={node.items.map((i) => `${i.kind}:${i.id}`)} strategy={verticalListSortingStrategy}>
                            <Stack gap="sm">
                              {node.items.map((item, itemIndex) => {
                                const content = renderItem(item);
                                if (content === null) return null;
                                const key = `${item.kind}:${item.id}`;
                                return (
                                  <SortableRow key={key} id={key} compact={compact} disabled={disabled} canUp={itemIndex > 0} canDown={itemIndex < node.items.length - 1}
                                    onMove={(delta) => commit(moveBy(nodes, key, delta))}
                                    moveTargets={sectionsList} currentSection={node.id} onMoveTo={(sectionId) => commit(moveToSection(nodes, key, sectionId))}>
                                    {content}
                                  </SortableRow>
                                );
                              })}
                            </Stack>
                          </SortableContext>
                        </DndContext>
                        </Box>
                      )}
                    </Stack>
                  </Card>
                </SortableRow>
              );
            })}
          </Stack>
        </SortableContext>
      </DndContext>
    </Stack>
  );

  const previewBody = buyerView ? (
    <TicketSelector
      products={buyerView.products}
      bundles={buyerView.bundles}
      ticketLayout={buyerLayoutFrom(nodes, buyerView)}
      quantities={{}}
      onQuantityChange={() => {}}
      onBundleQuantityChange={() => {}}
      currencyCode={currencyCode}
      readOnly
    />
  ) : (
    <Text size="sm" c="dimmed">Loading…</Text>
  );

  // What the sheet's title says: how much buyers see, and how much is held back.
  const visibleTickets = buyerView
    ? buyerView.products.reduce((n, p) => n + (p.type === "TIERED" ? (p.options?.length ?? 0) : 1), 0) + buyerView.bundles.length
    : 0;
  const hiddenCount = buyerView
    ? nodes.flatMap((n) => (n.type === "section" ? n.items : [n])).filter((i) => !shown(i)).length
    : 0;

  const preview = (
    <Paper withBorder radius="lg" p="md">
      <Stack gap="sm">
        <Group gap="xs"><IconEye size={16} aria-hidden="true" /><Text fw={600} size="sm">What buyers see</Text></Group>
        {previewBody}
      </Stack>
    </Paper>
  );

  return (
    <div ref={containerRef}>
      {layoutQuery.isError && nodes.length === 0 ? (
        <Text c="red" size="sm">Could not load the ticket order. Refresh to try again.</Text>
      ) : wide ? (
        <Group align="flex-start" wrap="nowrap" gap="lg">
          <Box style={{ flex: "1 1 58%", minWidth: 0 }}>{list}</Box>
          <Box style={{ flex: "1 1 42%", minWidth: 0, position: "sticky", top: 16 }}>{preview}</Box>
        </Group>
      ) : (
        <Box>
          {list}
          {/* Stays in reach at the bottom of the screen while the list is scrolled. */}
          <Box style={{ position: "sticky", bottom: 12, zIndex: 5, display: "flex", justifyContent: "center", marginTop: 12, pointerEvents: "none" }}>
            <Button radius="xl" size="sm" leftSection={<IconEye size={16} />} onClick={() => setPreviewOpen(true)} style={{ pointerEvents: "auto", boxShadow: "var(--mantine-shadow-md)" }}>
              Preview
            </Button>
          </Box>
        </Box>
      )}

      <Drawer
        opened={previewOpen && !wide}
        onClose={() => setPreviewOpen(false)}
        position="bottom"
        size="85%"
        radius="lg"
        title={<Text fw={600} size="sm">What buyers see · {visibleTickets} {visibleTickets === 1 ? "ticket" : "tickets"}</Text>}
      >
        <Stack gap="sm">
          {hiddenCount > 0 && <Text size="xs" c="orange.8">{hiddenCount} {hiddenCount === 1 ? "item is" : "items are"} not shown to buyers (paused or only sold in bundles).</Text>}
          {previewBody}
        </Stack>
      </Drawer>

      {sectionModal !== null && (
        <SectionModal
          section={sectionModal === "new" ? null : sectionModal}
          onClose={() => setSectionModal(null)}
          onSave={async (values) => {
            setSectionModal(null);
            await runSection(() =>
              sectionModal === "new" ? createTicketSection(eventId, values) : updateTicketSection(eventId, sectionModal.id, values),
            );
          }}
        />
      )}
    </div>
  );
}

function SortableRow({ id, compact, disabled, canUp, canDown, onMove, children, moveTargets, currentSection, onMoveTo }: {
  id: string; compact: boolean; disabled: boolean; canUp: boolean; canDown: boolean; onMove: (delta: -1 | 1) => void; children: ReactNode;
  /** Items only: where else it can go. */
  moveTargets?: LayoutSectionNode[]; currentSection?: number | null; onMoveTo?: (sectionId: number | null) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const canMove = !disabled && onMoveTo && moveTargets && (currentSection !== null || moveTargets.length > 0);
  const grip = (
    <ActionIcon ref={setActivatorNodeRef} variant="subtle" color="gray" size="sm" aria-label="Drag to reorder" style={{ cursor: "grab", touchAction: "none" }} {...attributes} {...listeners}>
      <IconGripVertical size={16} />
    </ActionIcon>
  );
  const up = <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Move up" disabled={!canUp} onClick={() => onMove(-1)}><IconArrowUp size={16} /></ActionIcon>;
  const down = <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Move down" disabled={!canDown} onClick={() => onMove(1)}><IconArrowDown size={16} /></ActionIcon>;
  const moveMenu = canMove ? (
    <Menu position="bottom-end" shadow="md" withinPortal>
      <Menu.Target>
        <Tooltip label="Move to a section"><ActionIcon variant="subtle" color="gray" size={compact ? "sm" : "lg"} aria-label="Move to a section"><IconArrowsMove size={16} /></ActionIcon></Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        {currentSection !== null && currentSection !== undefined && <Menu.Item onClick={() => onMoveTo(null)}>Move out of section</Menu.Item>}
        {moveTargets.filter((s) => s.id !== currentSection).map((s) => (
          <Menu.Item key={s.id} onClick={() => onMoveTo(s.id)}>Into “{s.title}”</Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  ) : null;

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}>
      {compact ? (
        // One slim bar above a full-width card: nothing steals width from the card's own text.
        <Stack gap={4}>
          {!disabled && (
            <Group justify="space-between" wrap="nowrap" gap={2}>
              <Group gap={2} wrap="nowrap">{grip}{up}{down}</Group>
              {moveMenu}
            </Group>
          )}
          <Box style={{ minWidth: 0 }}>{children}</Box>
        </Stack>
      ) : (
        <Group wrap="nowrap" align="stretch" gap="xs">
          {!disabled && (
            <Stack gap={2} justify="center" style={{ flex: "0 0 auto" }}>{grip}{up}{down}</Stack>
          )}
          <Box style={{ flex: 1, minWidth: 0 }}>{children}</Box>
          {moveMenu}
        </Group>
      )}
    </div>
  );
}

function SectionModal({ section, onClose, onSave }: {
  section: LayoutSectionNode | null;
  onClose: () => void;
  onSave: (values: { title: string; description: string | null; collapsed_by_default: boolean }) => void;
}) {
  const [title, setTitle] = useState(section?.title ?? "");
  const [description, setDescription] = useState(section?.description ?? "");
  const [collapsed, setCollapsed] = useState(section?.collapsed_by_default ?? false);
  const trimmed = title.trim();
  return (
    <Modal opened onClose={onClose} title={section ? "Edit section" : "Add section"} centered>
      <Stack gap="md">
        <TextInput label="Title" placeholder="e.g. Solo, Duo & Crew, VIP" maxLength={60} value={title} onChange={(e) => setTitle(e.currentTarget.value)} data-autofocus />
        <TextInput label="Short description (optional)" placeholder="e.g. Best for groups of 3 to 5" maxLength={140} value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
        <Switch label="Start collapsed" description="Buyers see just the heading until they open it. It opens by itself if something in it is already selected." checked={collapsed} onChange={(e) => setCollapsed(e.currentTarget.checked)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button disabled={trimmed === ""} onClick={() => onSave({ title: trimmed, description: description.trim() === "" ? null : description.trim(), collapsed_by_default: collapsed })}>
            {section ? "Save" : "Add section"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
