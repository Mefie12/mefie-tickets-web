import { describe, expect, it, vi } from "vitest";

const backendRequest = vi.fn();
vi.mock("@/lib/backend", () => ({ backendRequest: (...args: unknown[]) => backendRequest(...args) }));

import { NextRequest } from "next/server";
import { handleTokenEntry } from "@/lib/tokenEntry";
import { decodePreviewCookie } from "@/lib/previewCookie";

const req = () => new NextRequest("http://localhost:3000/claim/abc");
const resolveDestination = (status: string) => `/continue?state=${status}`;
const failure = (status: number) => ({ ok: false, status, data: null, setCookieHeaders: [] });

describe("handleTokenEntry", () => {
  it("defaults a 5xx failure to notfound", async () => {
    backendRequest.mockResolvedValueOnce(failure(503));
    const res = await handleTokenEntry(req(), { backendPath: "/x", previewCookie: null, resolveDestination });
    expect(res.headers.get("location")).toContain("state=notfound");
  });

  it("uses unavailableState for status >= 500", async () => {
    backendRequest.mockResolvedValueOnce(failure(503));
    const res = await handleTokenEntry(req(), { backendPath: "/x", previewCookie: null, resolveDestination, unavailableState: "unavailable" });
    expect(res.headers.get("location")).toContain("state=unavailable");
  });

  it("keeps notfound for a 404 even with unavailableState", async () => {
    backendRequest.mockResolvedValueOnce(failure(404));
    const res = await handleTokenEntry(req(), { backendPath: "/x", previewCookie: null, resolveDestination, unavailableState: "unavailable" });
    expect(res.headers.get("location")).toContain("state=notfound");
  });

  it("uses the injected request function", async () => {
    const custom = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { status: "claimable" }, setCookieHeaders: [] });
    const res = await handleTokenEntry(req(), { backendPath: "/x", previewCookie: null, resolveDestination, request: custom as never });
    expect(custom).toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("state=claimable");
  });
  describe("preview cookie", () => {
    const previewData = {
      status: "claimable",
      inviter_first_name: "George",
      event: { title: "December To Remember \u2014 George\u2019s UK" },
    };
    const ok = (data: Record<string, unknown>) => ({ ok: true, status: 200, data, setCookieHeaders: [] });

    it("is stored ASCII-safe, so it can never break a later header, and reads back intact", async () => {
      backendRequest.mockResolvedValueOnce(ok(previewData));
      const res = await handleTokenEntry(req(), {
        backendPath: "/x",
        previewCookie: { name: "mefie_claim_preview", minutes: 30 },
        resolveDestination,
      });

      const stored = res.cookies.get("mefie_claim_preview")?.value ?? "";
      expect(stored).toMatch(/^b64\.[A-Za-z0-9_-]+$/);
      expect(res.headers.get("set-cookie")).toContain("mefie_claim_preview=b64.");
      // The flow-control `status` is stripped; the render payload survives with its curly quote and em dash.
      expect(decodePreviewCookie(stored)).toEqual({
        inviter_first_name: "George",
        event: { title: "December To Remember \u2014 George\u2019s UK" },
      });
    });

    it("writes no preview cookie when the entry has none (locator flow)", async () => {
      backendRequest.mockResolvedValueOnce(ok(previewData));
      const res = await handleTokenEntry(req(), { backendPath: "/x", previewCookie: null, resolveDestination });
      expect(res.cookies.get("mefie_claim_preview")).toBeUndefined();
    });

    it("writes none when the link is not claimable (backend failure)", async () => {
      backendRequest.mockResolvedValueOnce(failure(404));
      const res = await handleTokenEntry(req(), {
        backendPath: "/x",
        previewCookie: { name: "mefie_claim_preview", minutes: 30 },
        resolveDestination,
      });
      expect(res.cookies.get("mefie_claim_preview")).toBeUndefined();
    });
  });
});
