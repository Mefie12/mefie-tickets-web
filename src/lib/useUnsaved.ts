"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { NO_UNSAVED, unsavedRegistry, type UnsavedSnapshot } from "@/lib/unsavedChangesRegistry";

/** Which forms are dirty right now. */
export function useUnsaved(): UnsavedSnapshot {
  return useSyncExternalStore(unsavedRegistry.subscribe, unsavedRegistry.getSnapshot, () => NO_UNSAVED);
}

/**
 * Put a screen that has its own save buttons (no SaveBar) under the same protection: the leave
 * guards, the tab-title marker and tab dots all see its unsaved edits.
 */
export function useUnsavedRegistration(id: string, label: string, dirty: boolean, discard: () => void) {
  const discardRef = useRef(discard);
  useEffect(() => {
    discardRef.current = discard;
  });
  const stableDiscard = useCallback(() => discardRef.current(), []);
  useEffect(() => {
    unsavedRegistry.set(id, { label, dirty, discard: stableDiscard });
  }, [id, label, dirty, stableDiscard]);
  useEffect(() => () => unsavedRegistry.remove(id), [id]);
}
