/**
 * Which forms on screen hold edits that haven't been saved. A plain store (not React state) so
 * the sidebar, the tab bar and the leave guards can all read it without prop drilling, and so the
 * logic is testable without a DOM.
 */
export type UnsavedEntry = { label: string; dirty: boolean; discard: () => void };
export type UnsavedSnapshot = { dirtyIds: readonly string[]; dirtyLabels: readonly string[] };

export const NO_UNSAVED: UnsavedSnapshot = { dirtyIds: [], dirtyLabels: [] };

export function createUnsavedRegistry() {
  const entries = new Map<string, UnsavedEntry>();
  const listeners = new Set<() => void>();
  let snapshot: UnsavedSnapshot = NO_UNSAVED;

  /** Rebuild the snapshot; returns true only if it changed (so `useSyncExternalStore` gets a stable reference otherwise). */
  function recompute(): boolean {
    const dirtyIds: string[] = [];
    const dirtyLabels: string[] = [];
    for (const [id, entry] of entries) {
      if (entry.dirty) {
        dirtyIds.push(id);
        dirtyLabels.push(entry.label);
      }
    }
    const same =
      dirtyIds.length === snapshot.dirtyIds.length &&
      dirtyIds.every((id, i) => id === snapshot.dirtyIds[i]) &&
      dirtyLabels.every((label, i) => label === snapshot.dirtyLabels[i]);
    if (same) return false;
    snapshot = dirtyIds.length === 0 ? NO_UNSAVED : { dirtyIds, dirtyLabels };
    return true;
  }
  const emit = () => listeners.forEach((listener) => listener());

  return {
    set(id: string, entry: UnsavedEntry) {
      entries.set(id, entry);
      if (recompute()) emit();
    },
    remove(id: string) {
      if (entries.delete(id) && recompute()) emit();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
  };
}

/** The one registry the console uses. */
export const unsavedRegistry = createUnsavedRegistry();
