import { beforeEach, describe, expect, it } from "vitest";
import { clearAdminDraft, isAdminStepUpError, peekAdminDraft, saveAdminDraft } from "@/lib/adminDraft";

function installStorage() {
  const data = new Map<string, string>();
  (globalThis as { sessionStorage?: unknown }).sessionStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("admin drafts", () => {
  beforeEach(installStorage);

  it("returns a saved draft until it is cleared", () => {
    saveAdminDraft("k", { percent: "2.35", reference: "Contract" });
    expect(peekAdminDraft("k")).toEqual({ percent: "2.35", reference: "Contract" });
    expect(peekAdminDraft("k")).toEqual({ percent: "2.35", reference: "Contract" });
    clearAdminDraft("k");
    expect(peekAdminDraft("k")).toBeNull();
  });

  it("drops a stale draft", () => {
    saveAdminDraft("k", { a: 1 });
    expect(peekAdminDraft("k", Date.now() + 31 * 60 * 1000)).toBeNull();
  });

  it("survives broken storage and corrupt data", () => {
    (globalThis as { sessionStorage?: unknown }).sessionStorage = undefined;
    expect(() => saveAdminDraft("k", {})).not.toThrow();
    expect(peekAdminDraft("k")).toBeNull();
    installStorage();
    sessionStorage.setItem("k", "{not json");
    expect(peekAdminDraft("k")).toBeNull();
  });
});

describe("isAdminStepUpError", () => {
  it("matches only the step-up codes", () => {
    expect(isAdminStepUpError({ code: "ADMIN_RECENT_AUTH_REQUIRED" })).toBe(true);
    expect(isAdminStepUpError({ code: "ADMIN_MFA_REQUIRED" })).toBe(true);
    expect(isAdminStepUpError({ code: "OTHER" })).toBe(false);
    expect(isAdminStepUpError(null)).toBe(false);
  });
});
