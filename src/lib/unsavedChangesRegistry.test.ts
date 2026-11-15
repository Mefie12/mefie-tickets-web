import { describe, expect, it, vi } from "vitest";
import { createUnsavedRegistry } from "@/lib/unsavedChangesRegistry";
import { deriveSaveStatus, invalidMessage, isDirtyAgainst } from "@/lib/saveStatus";

const entry = (dirty: boolean, label = "Details") => ({ label, dirty, discard: vi.fn() });

describe("unsaved registry", () => {
  it("tracks which forms are dirty and their labels", () => {
    const r = createUnsavedRegistry();
    r.set("a", entry(false));
    expect(r.getSnapshot().dirtyIds).toEqual([]);
    r.set("a", entry(true, "Details"));
    r.set("b", entry(true, "Location"));
    expect(r.getSnapshot().dirtyIds).toEqual(["a", "b"]);
    expect(r.getSnapshot().dirtyLabels).toEqual(["Details", "Location"]);
  });

  it("clears an entry when it is saved or unmounted", () => {
    const r = createUnsavedRegistry();
    r.set("a", entry(true));
    r.set("a", entry(false));
    expect(r.getSnapshot().dirtyIds).toEqual([]);
    r.set("b", entry(true));
    r.remove("b");
    expect(r.getSnapshot().dirtyIds).toEqual([]);
  });

  it("keeps a stable snapshot reference when nothing changed and notifies only on change", () => {
    const r = createUnsavedRegistry();
    const listener = vi.fn();
    r.subscribe(listener);
    r.set("a", entry(true));
    const first = r.getSnapshot();
    r.set("a", entry(true));
    expect(r.getSnapshot()).toBe(first);
    expect(listener).toHaveBeenCalledTimes(1);
    r.set("a", entry(false));
    expect(listener).toHaveBeenCalledTimes(2);
  });

});

describe("dirty comparison", () => {
  it("is clean at the baseline, dirty after an edit, clean again when the edit is reverted", () => {
    const baseline = JSON.stringify({ title: "A", ids: ["1"] });
    expect(isDirtyAgainst(baseline, { title: "A", ids: ["1"] })).toBe(false);
    expect(isDirtyAgainst(baseline, { title: "AB", ids: ["1"] })).toBe(true);
    expect(isDirtyAgainst(baseline, { title: "A", ids: ["1"] })).toBe(false);
  });
});

describe("save status", () => {
  const base = { dirty: false, saving: false, errorMessage: null, justSaved: false, invalidCount: 0 };
  it("prefers saving, then error, then invalid, then dirty, then saved", () => {
    expect(deriveSaveStatus({ ...base, dirty: true, saving: true, errorMessage: "x" }).kind).toBe("saving");
    expect(deriveSaveStatus({ ...base, dirty: true, errorMessage: "Network" })).toEqual({ kind: "error", message: "Network" });
    expect(deriveSaveStatus({ ...base, dirty: true, invalidCount: 2 })).toEqual({ kind: "invalid", count: 2 });
    expect(deriveSaveStatus({ ...base, dirty: true }).kind).toBe("dirty");
    expect(deriveSaveStatus({ ...base, justSaved: true }).kind).toBe("saved");
    expect(deriveSaveStatus(base).kind).toBe("clean");
  });

  it("words the invalid count", () => {
    expect(invalidMessage(1)).toBe("1 field needs attention");
    expect(invalidMessage(3)).toBe("3 fields need attention");
  });
});
