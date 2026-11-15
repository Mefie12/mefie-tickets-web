import { describe, expect, it, vi } from "vitest";
import { performSignOut } from "@/lib/signOut";

const deps = (over: Partial<Parameters<typeof performSignOut>[0]> = {}) => ({
  logout: vi.fn().mockResolvedValue({}),
  stillSignedIn: vi.fn().mockResolvedValue(false),
  clearClientState: vi.fn(),
  ...over,
});

describe("performSignOut", () => {
  it("clears client state and reports signed out when logout succeeds, without re-checking", async () => {
    const d = deps();
    await expect(performSignOut(d)).resolves.toBe("signed-out");
    expect(d.clearClientState).toHaveBeenCalledOnce();
    expect(d.stillSignedIn).not.toHaveBeenCalled();
  });

  it("treats a failed logout as signed out when the server then says there is no session", async () => {
    const d = deps({ logout: vi.fn().mockRejectedValue(new Error("timeout")) });
    await expect(performSignOut(d)).resolves.toBe("signed-out");
    expect(d.clearClientState).toHaveBeenCalledOnce();
  });

  it("reports failure when the logout failed and the session is still live", async () => {
    const d = deps({ logout: vi.fn().mockRejectedValue(new Error("offline")), stillSignedIn: vi.fn().mockResolvedValue(true) });
    await expect(performSignOut(d)).resolves.toBe("failed");
    expect(d.clearClientState).toHaveBeenCalledOnce();
  });

  it("reports failure when even the session check cannot be made", async () => {
    const d = deps({ logout: vi.fn().mockRejectedValue(new Error("offline")), stillSignedIn: vi.fn().mockRejectedValue(new Error("offline")) });
    await expect(performSignOut(d)).resolves.toBe("failed");
  });
});
