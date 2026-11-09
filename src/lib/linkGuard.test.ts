import { describe, expect, it } from "vitest";
import { linkGuardTarget } from "@/lib/linkGuard";

const here = { origin: "https://app.test", pathname: "/events/1/settings", search: "?tab=details" };
const click = (href: string, over: Partial<Parameters<typeof linkGuardTarget>[0]> = {}) =>
  linkGuardTarget({ href, target: null, download: false, button: 0, modified: false, ...over }, here);

describe("linkGuardTarget", () => {
  it("holds an ordinary in-app link and returns where it goes", () => {
    expect(click("/organization/payments")).toBe("/organization/payments");
    expect(click("https://app.test/events?view=past#top")).toBe("/events?view=past#top");
  });

  it("lets through clicks that cannot lose edits", () => {
    expect(click("/dashboard", { modified: true })).toBeNull();
    expect(click("/dashboard", { button: 1 })).toBeNull();
    expect(click("/dashboard", { target: "_blank" })).toBeNull();
    expect(click("/api/events/1/terms/pdf", { download: true })).toBeNull();
  });

  it("leaves other sites to the browser and ignores links to this same page", () => {
    expect(click("https://stripe.com/x")).toBeNull();
    expect(click("/events/1/settings?tab=details")).toBeNull();
    expect(click("#section")).toBeNull();
  });

  it("holds a link to the same path with a different query", () => {
    expect(click("/events/1/settings?tab=location")).toBe("/events/1/settings?tab=location");
  });
});
