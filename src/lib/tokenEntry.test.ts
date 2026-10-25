import { describe, expect, it, vi } from "vitest";

const backendRequest = vi.fn();
vi.mock("@/lib/backend", () => ({ backendRequest: (...args: unknown[]) => backendRequest(...args) }));

import { NextRequest } from "next/server";
import { handleTokenEntry } from "@/lib/tokenEntry";

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
});
