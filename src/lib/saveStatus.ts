/** What the save bar's status line should say, in priority order. Pure so it can be tested. */
export type SaveStatusInput = {
  dirty: boolean;
  saving: boolean;
  errorMessage: string | null;
  justSaved: boolean;
  invalidCount: number;
};

export type SaveStatus =
  | { kind: "saving" }
  | { kind: "error"; message: string }
  | { kind: "invalid"; count: number }
  | { kind: "dirty" }
  | { kind: "saved" }
  | { kind: "clean" };

export function deriveSaveStatus(s: SaveStatusInput): SaveStatus {
  if (s.saving) return { kind: "saving" };
  if (s.errorMessage) return { kind: "error", message: s.errorMessage };
  if (s.dirty && s.invalidCount > 0) return { kind: "invalid", count: s.invalidCount };
  if (s.dirty) return { kind: "dirty" };
  if (s.justSaved) return { kind: "saved" };
  return { kind: "clean" };
}

/** "2 fields need attention". */
export function invalidMessage(count: number): string {
  return `${count} ${count === 1 ? "field needs" : "fields need"} attention`;
}

/** Dirty means "differs from what was last saved", so reverting an edit makes the form clean again. */
export function isDirtyAgainst(baseline: string, values: unknown): boolean {
  return JSON.stringify(values) !== baseline;
}
