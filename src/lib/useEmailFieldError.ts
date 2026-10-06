"use client";

import { useEffect, useState } from "react";
import { emailFieldError, INVALID_EMAIL_MESSAGE } from "@/lib/emailFieldError";

/** How long typing must pause before a wrong address is flagged without the field being left. */
export const EMAIL_ERROR_IDLE_MS = 1_000;

/**
 * When to show "enter a valid email" next to a field whose button stays disabled until the address is valid.
 * Shown when the field is left, or after the person stops typing for a moment. Leaving the field alone is not
 * enough: on a phone, tapping a disabled button does not move focus, so the error would never appear and the
 * button would just look dead. A value that was already in the field (a prefilled address) is judged the same way.
 */
export function useEmailFieldError(value: string, ok: boolean, message: string = INVALID_EMAIL_MESSAGE) {
  const [left, setLeft] = useState(false);
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIdle(true), EMAIL_ERROR_IDLE_MS);
    return () => { clearTimeout(timer); setIdle(false); };
  }, [value]);

  return {
    error: emailFieldError({ value, ok, shown: left || idle, message }),
    onBlur: () => setLeft(true),
    reset: () => setLeft(false),
  };
}
