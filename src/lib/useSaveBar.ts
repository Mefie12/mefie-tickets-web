"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UseFormReturnType } from "@mantine/form";
import { isDirtyAgainst } from "@/lib/saveStatus";
import { unsavedRegistry } from "@/lib/unsavedChangesRegistry";

const SAVED_FLASH_MS = 4000;

type Adapter<T> = {
  /** The current values, as of this render. */
  values: T;
  /** The latest committed values, for callbacks that run later (save success, Discard). */
  getValues: () => T;
  /** Put values back (Discard). */
  setValues: (values: T) => void;
  clearErrors?: () => void;
  /** True while the screen shows validation errors; lets a stale "N fields need attention" clear itself. */
  hasErrors?: boolean;
};

/**
 * The engine behind every SaveBar: dirty tracking against the last saved values (so reverting an edit
 * makes it clean), the "Saved" flash, failed-save and invalid-submit messages, Discard, Cmd/Ctrl+S,
 * and registration with the unsaved-changes registry (tab dots, leave guards).
 *
 * `onSave` is for screens whose Save is a click handler rather than a form submit.
 */
function useSaveBarCore<T>({
  id,
  label,
  saving,
  disabled = false,
  adapter,
  onSave,
}: {
  id: string;
  label: string;
  saving: boolean;
  disabled?: boolean;
  adapter: Adapter<T>;
  onSave?: () => void;
}) {
  const [baseline, setBaseline] = useState(() => JSON.stringify(adapter.getValues()));
  // Callbacks read these so they stay stable; they are synced after render, never read during it.
  const adapterRef = useRef(adapter);
  const baselineRef = useRef(baseline);
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    adapterRef.current = adapter;
    baselineRef.current = baseline;
    onSaveRef.current = onSave;
  });
  const [justSaved, setJustSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [invalidCount, setInvalidCount] = useState(0);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dirty = !disabled && isDirtyAgainst(baseline, adapter.values);
  const formId = `form-${id}`;

  const rebase = useCallback((values?: T) => {
    baselineRef.current = JSON.stringify(values ?? adapterRef.current.getValues());
    setBaseline(baselineRef.current);
  }, []);

  /** Call when a save succeeds. Pass the values the server answered with if they can differ from what was sent. */
  const markSaved = useCallback((values?: T) => {
    rebase(values);
    setErrorMessage(null);
    setInvalidCount(0);
    setJustSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setJustSaved(false), SAVED_FLASH_MS);
  }, [rebase]);

  const markFailed = useCallback((message: string) => setErrorMessage(message || "Please try again"), []);

  const discard = useCallback(() => {
    adapterRef.current.setValues(JSON.parse(baselineRef.current) as T);
    adapterRef.current.clearErrors?.();
    setInvalidCount(0);
    setErrorMessage(null);
  }, []);

  /** Mark how many things need attention (for Save handlers that validate themselves). */
  const flagInvalid = useCallback((count: number) => setInvalidCount(count), []);

  /** Pass as the second argument to Mantine's `form.onSubmit`: count the problems and put focus on the first one. */
  const onInvalid = useCallback(
    (errors: Record<string, unknown>) => {
      setInvalidCount(Object.keys(errors).length);
      requestAnimationFrame(() => {
        const field = document.getElementById(formId)?.querySelector<HTMLElement>('[aria-invalid="true"]');
        field?.focus();
        field?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    },
    [formId],
  );

  // A new edit, or the server answering, makes the old messages stale.
  const [prevDirty, setPrevDirty] = useState(dirty);
  if (dirty !== prevDirty) {
    setPrevDirty(dirty);
    if (dirty) {
      setJustSaved(false);
      setErrorMessage(null);
    }
  }
  const [prevSaving, setPrevSaving] = useState(saving);
  if (saving !== prevSaving) {
    setPrevSaving(saving);
    if (saving) setErrorMessage(null);
  }
  if (invalidCount > 0 && adapter.hasErrors === false) setInvalidCount(0);

  useEffect(() => {
    unsavedRegistry.set(id, { label, dirty, discard });
  }, [id, label, dirty, discard]);
  useEffect(() => () => unsavedRegistry.remove(id), [id]);
  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

  // Cmd/Ctrl+S saves the screen that is visible (several tabs stay mounted, only one is on screen).
  useEffect(() => {
    if (!dirty) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      const formEl = document.getElementById(formId) as HTMLFormElement | null;
      const visible = formEl ? formEl.offsetParent !== null : document.getElementById(`${formId}-bar`)?.offsetParent != null;
      if (!visible) return;
      // A dialog on top (a modal, the Discard confirm) owns the keyboard: don't save the form behind it.
      if (document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      if (formEl) formEl.requestSubmit();
      else onSaveRef.current?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dirty, formId]);

  return {
    formId,
    dirty,
    markSaved,
    markFailed,
    rebase,
    onInvalid,
    flagInvalid,
    barProps: { formId, dirty, saving, justSaved, errorMessage, invalidCount, onDiscard: discard, onSave },
  };
}

/**
 * For a Mantine `useForm` screen:
 *   const bar = useSaveBar({ id: "event-details", label: "Event details", form, saving: mutation.isPending, disabled });
 *   <form id={bar.formId} onSubmit={form.onSubmit(save, bar.onInvalid)}> ...
 *   mutation onSuccess: bar.markSaved();   onError: bar.markFailed(message);
 *   after the Card: <SaveBar {...bar.barProps} saveLabel="Save details" />
 */
export function useSaveBar<T extends Record<string, unknown>>({
  id,
  label,
  form,
  saving,
  disabled = false,
}: {
  id: string;
  label: string;
  form: UseFormReturnType<T>;
  saving: boolean;
  disabled?: boolean;
}) {
  return useSaveBarCore<T>({
    id,
    label,
    saving,
    disabled,
    adapter: {
      values: form.values,
      getValues: () => form.getValues(),
      setValues: (values) => form.setValues(values),
      clearErrors: () => form.clearErrors(),
      hasErrors: Object.keys(form.errors).length > 0,
    },
  });
}

/**
 * For a screen that keeps its state in `useState`: describe it as one plain object of everything the
 * organizer can edit, and say how to put it back. Pass `onSave` when Save is a click handler.
 */
export function useSaveBarValues<T>({
  id,
  label,
  values,
  setValues,
  saving,
  disabled = false,
  hasErrors,
  onSave,
}: {
  id: string;
  label: string;
  values: T;
  setValues: (values: T) => void;
  saving: boolean;
  disabled?: boolean;
  hasErrors?: boolean;
  onSave?: () => void;
}) {
  const latest = useRef(values);
  useEffect(() => {
    latest.current = values;
  });
  return useSaveBarCore<T>({
    id,
    label,
    saving,
    disabled,
    onSave,
    adapter: { values, getValues: () => latest.current, setValues, hasErrors },
  });
}
