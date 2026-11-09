"use client";

import { useCallback, useId, useState } from "react";
import type { UseFormReturnType } from "@mantine/form";
import { modals } from "@mantine/modals";
import { Text } from "@mantine/core";
import { isDirtyAgainst } from "@/lib/saveStatus";
import { useUnsavedRegistration } from "@/lib/useUnsaved";

/**
 * A modal form that asks before it throws edits away. Escape, a click outside, the X and Cancel all
 * go through `requestClose`: with nothing changed it closes at once; with edits it asks first
 * (Keep editing is the prominent choice). Saving closes the modal through the parent as before.
 * While open with edits, it also counts as unsaved for refresh/close and the tab-title marker.
 */
export function useGuardedClose<T extends Record<string, unknown>>(form: UseFormReturnType<T>, onClose: () => void, label = "an open form") {
  const [baseline] = useState(() => JSON.stringify(form.getValues()));
  const dirty = isDirtyAgainst(baseline, form.values);
  useUnsavedRegistration(`modal-${useId()}`, label, dirty, () => form.setValues(JSON.parse(baseline) as T));

  const requestClose = useCallback(() => {
    if (!dirty) {
      onClose();
      return;
    }
    modals.openConfirmModal({
      title: "Discard your changes?",
      centered: true,
      children: <Text size="sm">You have unsaved changes. If you close this, they will be lost.</Text>,
      labels: { confirm: "Discard changes", cancel: "Keep editing" },
      confirmProps: { color: "red", variant: "light" },
      cancelProps: { variant: "filled" },
      onConfirm: onClose,
    });
  }, [dirty, onClose]);

  return { dirty, requestClose };
}
