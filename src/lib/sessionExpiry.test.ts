import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/authApi";
import { handleSessionExpiry } from "@/lib/sessionExpiry";

function visit(pathname: string) {
  const assign = vi.fn();
  vi.stubGlobal("window", { location: { pathname, search: "", assign } });

  return assign;
}

describe("handleSessionExpiry", () => {
  afterEach(() => vi.unstubAllGlobals());

  const unauthenticated = new ApiError("Unauthenticated.", 401);

  it("redirects an expired organizer session to the login screen", () => {
    const assign = visit("/venue/events/12");
    expect(handleSessionExpiry(unauthenticated)).toBe(true);
    expect(assign).toHaveBeenCalledWith("/organizers/login?expired=1&next=%2Fvenue%2Fevents%2F12");
  });

  it.each(["/venue/invitations/abc", "/distributor/invitations/abc", "/organizers/login"])(
    "does not bounce a logged-out visitor off %s",
    (path) => {
      const assign = visit(path);
      expect(handleSessionExpiry(unauthenticated)).toBe(true);
      expect(assign).not.toHaveBeenCalled();
    },
  );
});
