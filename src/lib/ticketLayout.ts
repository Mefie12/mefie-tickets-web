import type { PublicBundle, PublicProduct } from "@/lib/publicEventApi";

/**
 * The ticket list as one arrangeable tree: tickets, ticket groups and
 * bundles ("items") either at the top level or inside a heading-only
 * section. The server sends the same shape publicly (already filtered to
 * what a buyer can see) and to the organizer (everything), so the editor's
 * preview and the public page run through the same code below.
 */
export type LayoutItemRef = { type: "item"; kind: "product" | "bundle"; id: number };
export type LayoutSectionNode = {
  type: "section";
  id: number;
  title: string;
  description: string | null;
  collapsed_by_default: boolean;
  items: LayoutItemRef[];
};
export type LayoutNode = LayoutItemRef | LayoutSectionNode;

export const nodeKey = (node: LayoutNode): string => (node.type === "section" ? `section:${node.id}` : `${node.kind}:${node.id}`);
export const itemKey = (item: LayoutItemRef): string => `${item.kind}:${item.id}`;

// --- buyer side -------------------------------------------------------------

export type ResolvedEntry = { kind: "product"; product: PublicProduct } | { kind: "bundle"; bundle: PublicBundle };
export type ResolvedNode =
  | { type: "entry"; entry: ResolvedEntry }
  | { type: "section"; id: number; title: string; description: string | null; collapsedByDefault: boolean; entries: ResolvedEntry[] };

/**
 * Join the layout with the products and bundles it points at. Anything the
 * layout lacks (an older payload, or something added a moment ago) is
 * appended at the end rather than silently disappearing; layout items with
 * no matching data (e.g. bundles while the feature is off) are skipped.
 */
export function resolveLayout(layout: LayoutNode[] | undefined, products: PublicProduct[], bundles: PublicBundle[]): ResolvedNode[] {
  const productById = new Map(products.map((p) => [p.id, p]));
  const bundleById = new Map(bundles.map((b) => [b.id, b]));
  const used = new Set<string>();

  const entryFor = (ref: LayoutItemRef): ResolvedEntry | null => {
    if (used.has(itemKey(ref))) return null;
    const entry: ResolvedEntry | null =
      ref.kind === "product"
        ? productById.has(ref.id) ? { kind: "product", product: productById.get(ref.id)! } : null
        : bundleById.has(ref.id) ? { kind: "bundle", bundle: bundleById.get(ref.id)! } : null;
    if (entry) used.add(itemKey(ref));
    return entry;
  };

  const out: ResolvedNode[] = [];
  for (const node of layout ?? []) {
    if (node.type === "item") {
      const entry = entryFor(node);
      if (entry) out.push({ type: "entry", entry });
      continue;
    }
    const entries = node.items.map(entryFor).filter((e): e is ResolvedEntry => e !== null);
    if (entries.length > 0) {
      out.push({ type: "section", id: node.id, title: node.title, description: node.description, collapsedByDefault: node.collapsed_by_default, entries });
    }
  }
  for (const product of products) {
    const entry = entryFor({ type: "item", kind: "product", id: product.id });
    if (entry) out.push({ type: "entry", entry });
  }
  for (const bundle of bundles) {
    const entry = entryFor({ type: "item", kind: "bundle", id: bundle.id });
    if (entry) out.push({ type: "entry", entry });
  }
  return out;
}

/** Does the cart hold anything from this group of entries? Used to keep a collapsed section open. */
export function entriesHaveSelection(entries: ResolvedEntry[], quantities: Record<string, number>): boolean {
  return entries.some((entry) =>
    entry.kind === "bundle"
      ? (quantities[`bundle:${entry.bundle.id}`] ?? 0) > 0
      : Object.entries(quantities).some(([key, qty]) => qty > 0 && key.startsWith(`${entry.product.id}:`)),
  );
}

// --- organizer side: pure edits, each returning a new tree --------------------

type Located = { container: number | null; index: number };

function locate(nodes: LayoutNode[], key: string): Located | null {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (nodeKey(node) === key) return { container: null, index: i };
    if (node.type === "section") {
      const j = node.items.findIndex((item) => itemKey(item) === key);
      if (j !== -1) return { container: node.id, index: j };
    }
  }
  return null;
}

const clone = (nodes: LayoutNode[]): LayoutNode[] => nodes.map((n) => (n.type === "section" ? { ...n, items: [...n.items] } : { ...n }));

function listOf(nodes: LayoutNode[], container: number | null): LayoutNode[] | LayoutItemRef[] {
  if (container === null) return nodes;
  return (nodes.find((n) => n.type === "section" && n.id === container) as LayoutSectionNode).items;
}

/** Move one step up (-1) or down (+1) inside its own container. No-op at the ends. */
export function moveBy(nodes: LayoutNode[], key: string, delta: -1 | 1): LayoutNode[] {
  const at = locate(nodes, key);
  if (!at) return nodes;
  const next = clone(nodes);
  const list = listOf(next, at.container) as unknown[];
  const to = at.index + delta;
  if (to < 0 || to >= list.length) return nodes;
  [list[at.index], list[to]] = [list[to], list[at.index]];
  return next;
}

/** Drag-and-drop: place `activeKey` where `overKey` is, if they share a container. */
export function reorderTo(nodes: LayoutNode[], activeKey: string, overKey: string): LayoutNode[] {
  const from = locate(nodes, activeKey);
  const to = locate(nodes, overKey);
  if (!from || !to || from.container !== to.container || from.index === to.index) return nodes;
  const next = clone(nodes);
  const list = listOf(next, from.container) as unknown[];
  const [moved] = list.splice(from.index, 1);
  list.splice(to.index, 0, moved);
  return next;
}

/** Move an item into a section (appended) or out to the top level (right after the section it left). */
export function moveToSection(nodes: LayoutNode[], key: string, sectionId: number | null): LayoutNode[] {
  const at = locate(nodes, key);
  if (!at || at.container === sectionId || key.startsWith("section:")) return nodes;
  const next = clone(nodes);
  const source = listOf(next, at.container) as unknown[];
  const [moved] = source.splice(at.index, 1) as LayoutItemRef[];
  if (sectionId === null) {
    const after = next.findIndex((n) => n.type === "section" && n.id === at.container);
    next.splice(after === -1 ? next.length : after + 1, 0, moved);
  } else {
    (listOf(next, sectionId) as LayoutItemRef[]).push(moved);
  }
  return next;
}

/**
 * Indent (drag right): a top-level item directly under a section joins the end of that section.
 * No-op for anything else, so dragging right under a plain ticket does nothing.
 */
export function indentUnderSection(nodes: LayoutNode[], key: string): LayoutNode[] {
  const at = locate(nodes, key);
  if (!at || at.container !== null || key.startsWith("section:")) return nodes;
  const above = nodes[at.index - 1];
  return above && above.type === "section" ? moveToSection(nodes, key, above.id) : nodes;
}

/** A section deleted locally: its items take its slot, in order (matches the server). */
export function spliceOutSection(nodes: LayoutNode[], sectionId: number): LayoutNode[] {
  return nodes.flatMap((n) => (n.type === "section" && n.id === sectionId ? n.items : [n]));
}

/** What the API's PUT takes: ids and structure only. */
export function toPayload(nodes: LayoutNode[]) {
  return nodes.map((n) =>
    n.type === "section"
      ? { type: "section" as const, id: n.id, items: n.items.map((i) => ({ type: "item" as const, kind: i.kind, id: i.id })) }
      : { type: "item" as const, kind: n.kind, id: n.id },
  );
}

/**
 * The buyer's layout for the organizer's preview: the organizer's own (possibly just-edited)
 * tree, minus anything the server's buyer view doesn't include, and minus sections left empty.
 * Visibility stays the server's call (it is the same code the public page runs); only the
 * order and section membership come from the local tree, so a drag shows instantly.
 */
export function buyerLayoutFrom(nodes: LayoutNode[], view: { products: { id: number }[]; bundles: { id: number }[] }): LayoutNode[] {
  const products = new Set(view.products.map((p) => p.id));
  const bundles = new Set(view.bundles.map((b) => b.id));
  const visible = (item: LayoutItemRef) => (item.kind === "product" ? products.has(item.id) : bundles.has(item.id));
  return nodes.flatMap((node): LayoutNode[] => {
    if (node.type === "item") return visible(node) ? [node] : [];
    const items = node.items.filter(visible);
    return items.length > 0 ? [{ ...node, items }] : [];
  });
}
