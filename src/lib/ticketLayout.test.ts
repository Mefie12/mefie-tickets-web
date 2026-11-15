import { describe, expect, it } from "vitest";
import {
  buyerLayoutFrom, entriesHaveSelection, indentUnderSection, moveBy, moveToSection, nodeKey, reorderTo, resolveLayout, spliceOutSection, toPayload,
  type LayoutNode,
} from "@/lib/ticketLayout";
import type { PublicBundle, PublicProduct } from "@/lib/publicEventApi";

const p = (id: number) => ({ id, title: `P${id}`, type: "PAID" }) as unknown as PublicProduct;
const b = (id: number) => ({ id, title: `B${id}`, components: [] }) as unknown as PublicBundle;
const item = (kind: "product" | "bundle", id: number) => ({ type: "item" as const, kind, id });
const section = (id: number, items: ReturnType<typeof item>[]): LayoutNode => ({ type: "section", id, title: `S${id}`, description: null, collapsed_by_default: false, items });
const keys = (nodes: LayoutNode[]) => nodes.map((n) => (n.type === "section" ? `${nodeKey(n)}[${n.items.map((i) => `${i.kind}:${i.id}`).join(",")}]` : nodeKey(n)));

describe("resolveLayout", () => {
  it("mixes tickets and packages in layout order, with sections", () => {
    const out = resolveLayout([item("bundle", 1), section(9, [item("product", 2), item("product", 1)])], [p(1), p(2)], [b(1)]);
    expect(out.map((n) => (n.type === "entry" ? n.entry.kind : `section:${n.entries.length}`))).toEqual(["bundle", "section:2"]);
  });

  it("falls back to tickets then packages when there is no layout, and never drops unlisted items", () => {
    expect(resolveLayout(undefined, [p(1), p(2)], [b(1)]).map((n) => n.type === "entry" && n.entry.kind)).toEqual(["product", "product", "bundle"]);
    const out = resolveLayout([item("product", 2)], [p(1), p(2)], []);
    expect(out.map((n) => n.type === "entry" && n.entry.kind === "product" && n.entry.product.id)).toEqual([2, 1]);
  });

  it("skips layout items with no data and sections left empty by that", () => {
    expect(resolveLayout([section(9, [item("bundle", 5)]), item("bundle", 6)], [p(1)], [])).toHaveLength(1);
  });
});

describe("entriesHaveSelection", () => {
  it("sees a selected option of a group and a selected bundle", () => {
    const entries = resolveLayout([section(1, [item("product", 3), item("bundle", 4)])], [p(3)], [b(4)]);
    const inSection = entries[0].type === "section" ? entries[0].entries : [];
    expect(entriesHaveSelection(inSection, {})).toBe(false);
    expect(entriesHaveSelection(inSection, { "3:77": 2 })).toBe(true);
    expect(entriesHaveSelection(inSection, { "bundle:4": 1 })).toBe(true);
    expect(entriesHaveSelection(inSection, { "30:direct": 1 })).toBe(false);
  });
});

describe("organizer edits", () => {
  const base = (): LayoutNode[] => [item("product", 1), section(9, [item("product", 2), item("bundle", 3)]), item("product", 4)];

  it("moves one step inside its own container and stops at the ends", () => {
    expect(keys(moveBy(base(), "product:1", 1))).toEqual(["section:9[product:2,bundle:3]", "product:1", "product:4"]);
    expect(keys(moveBy(base(), "bundle:3", -1))).toEqual(["product:1", "section:9[bundle:3,product:2]", "product:4"]);
    expect(moveBy(base(), "product:1", -1)).toEqual(base());
    expect(moveBy(base(), "bundle:3", 1)).toEqual(base());
  });

  it("reorders by drag only within one container", () => {
    expect(keys(reorderTo(base(), "product:4", "product:1"))).toEqual(["product:4", "product:1", "section:9[product:2,bundle:3]"]);
    expect(reorderTo(base(), "product:1", "bundle:3")).toEqual(base());
  });

  it("moves into a section (appended) and back out (just after it)", () => {
    const inSection = moveToSection(base(), "product:4", 9);
    expect(keys(inSection)).toEqual(["product:1", "section:9[product:2,bundle:3,product:4]"]);
    expect(keys(moveToSection(inSection, "product:2", null))).toEqual(["product:1", "section:9[bundle:3,product:4]", "product:2"]);
    expect(moveToSection(base(), "section:9", null)).toEqual(base());
  });

  it("deleting a section puts its items in its slot, in order", () => {
    expect(keys(spliceOutSection(base(), 9))).toEqual(["product:1", "product:2", "bundle:3", "product:4"]);
  });

  it("never mutates its input and serialises to ids only", () => {
    const original = base();
    moveBy(original, "product:1", 1);
    moveToSection(original, "product:4", 9);
    expect(original).toEqual(base());
    expect(toPayload(base())[1]).toEqual({ type: "section", id: 9, items: [item("product", 2), item("bundle", 3)] });
  });
});

describe("buyerLayoutFrom", () => {
  it("keeps local order, drops what the buyer can't see and sections left empty", () => {
    const nodes: LayoutNode[] = [item("bundle", 3), section(1, [item("product", 9)]), section(2, [item("product", 1), item("product", 9)]), item("product", 9)];
    const out = buyerLayoutFrom(nodes, { products: [{ id: 1 }], bundles: [{ id: 3 }] });
    expect(keys(out)).toEqual(["bundle:3", "section:2[product:1]"]);
  });
});

describe("indentUnderSection", () => {
  const nodes = (): LayoutNode[] => [section(9, [item("product", 2)]), item("product", 4), item("product", 5)];

  it("joins the section directly above, at its end", () => {
    expect(keys(indentUnderSection(nodes(), "product:4"))).toEqual(["section:9[product:2,product:4]", "product:5"]);
  });

  it("does nothing under a plain ticket, for sections, or for items already inside one", () => {
    expect(indentUnderSection(nodes(), "product:5")).toEqual(nodes());
    expect(indentUnderSection(nodes(), "section:9")).toEqual(nodes());
    expect(indentUnderSection(nodes(), "product:2")).toEqual(nodes());
  });
});
