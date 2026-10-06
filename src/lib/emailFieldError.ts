export const INVALID_EMAIL_MESSAGE = "Enter a valid email address";

/** Pure rule for when an email field shows its error: only for something typed, only once it is time to speak. */
export function emailFieldError({ value, ok, shown, message = INVALID_EMAIL_MESSAGE }: { value: string; ok: boolean; shown: boolean; message?: string }): string | undefined {
  return shown && value.trim() !== "" && !ok ? message : undefined;
}
