import { beforeEach, describe, expect, it, vi } from "vitest";

const backendRequest = vi.fn();
vi.mock("@/lib/backend", () => ({ backendRequest: (...args: unknown[]) => backendRequest(...args) }));
// React's request-scoped cache() only dedupes inside a server render; here it must simply pass through.
vi.mock("react", () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }));

import { getCurrentUser } from "@/lib/session";

const verifiedUser = { id: 1, first_name: "Ada", last_name: "L", email: "ada@example.com", email_verified_at: "2026-01-01T00:00:00Z", current_organization_id: "org-1" };
const ok = (data: unknown) => ({ status: 200, data });

beforeEach(() => backendRequest.mockReset());

describe("getCurrentUser", () => {
  it("takes the role from /users/me in a single call", async () => {
    backendRequest.mockResolvedValueOnce(ok({ user: verifiedUser, organization_role: "ADMIN" }));

    const user = await getCurrentUser();

    expect(user?.role).toBe("ADMIN");
    expect(backendRequest).toHaveBeenCalledTimes(1);
  });

  it("treats an explicit null role as no role, without a second call", async () => {
    backendRequest.mockResolvedValueOnce(ok({ user: verifiedUser, organization_role: null }));

    expect((await getCurrentUser())?.role).toBeNull();
    expect(backendRequest).toHaveBeenCalledTimes(1);
  });

  it("falls back to the team list when the API predates organization_role", async () => {
    backendRequest
      .mockResolvedValueOnce(ok({ user: verifiedUser }))
      .mockResolvedValueOnce(ok({ members: [{ type: "member", email: "ada@example.com", role: "ORGANIZER" }] }));

    expect((await getCurrentUser())?.role).toBe("ORGANIZER");
    expect(backendRequest).toHaveBeenCalledTimes(2);
  });

  it("gives an unverified user no role and makes no further call", async () => {
    backendRequest.mockResolvedValueOnce(ok({ user: { ...verifiedUser, email_verified_at: null }, organization_role: "ADMIN" }));

    expect((await getCurrentUser())?.role).toBeNull();
    expect(backendRequest).toHaveBeenCalledTimes(1);
  });

  it("is null for an anonymous visitor", async () => {
    backendRequest.mockResolvedValueOnce({ status: 401, data: null });

    expect(await getCurrentUser()).toBeNull();
  });
});
