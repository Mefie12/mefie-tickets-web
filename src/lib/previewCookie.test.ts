import { describe, expect, it } from "vitest";
import { decodePreviewCookie, encodePreviewCookie } from "@/lib/previewCookie";

const preview = (title: string, inviter = "George") => ({
  inviter_first_name: inviter,
  event: { title, start_date: "2026-12-27T17:00:00+00:00", timezone: "Africa/Accra" },
  ticket: { name: "STANDARD | CLASSIC", option: null },
  attendee_questions: [
    { id: 4, title: "Question 1", description: null, type: "TEXT", options: null, is_required: true },
    { id: 5, title: "Dietary — any needs?", description: "Tell us …", type: "RADIO", options: ["option 1", "option 2"], is_required: false },
  ],
  delivery_locked: false,
  masked_delivery_email: null,
});

describe("previewCookie", () => {
  it.each([
    ["plain ASCII", "December To Remember - UK"],
    ["curly apostrophe and em dash", "December To Remember — George’s UK"],
    ["ellipsis", "Wait… for it"],
    ["emoji", "Party \u{1F389}"],
    ["accented Latin-1", "José's Café"],
    ["Polish name", "Łukasz"],
    ["Chinese", "年末活动 李明"],
    ["quotes, braces and semicolons", 'He said "go"; {now}, % + / ='],
  ])("round-trips %s", (_label, title) => {
    const value = preview(title, title);
    expect(decodePreviewCookie(encodePreviewCookie(value))).toEqual(value);
  });

  it("is pure ASCII on the wire — the whole point (a non-ASCII value is what crashed pages)", () => {
    const encoded = encodePreviewCookie(preview("George’s — \u{1F389} 李明"));
    expect(encoded).toMatch(/^b64\.[A-Za-z0-9_-]+$/);
    expect(/[^\x20-\x7E]/.test(encoded)).toBe(false);
  });

  it("is no longer than the percent-encoded JSON it replaces", () => {
    for (const title of ["December To Remember - UK", "December To Remember — George’s UK", "年末活动"]) {
      const value = preview(title);
      expect(encodePreviewCookie(value).length).toBeLessThanOrEqual(encodeURIComponent(JSON.stringify(value)).length);
    }
  });

  it("still reads cookies written before this change (plain JSON), including non-ASCII ones", () => {
    const old = preview("George’s — Party");
    expect(decodePreviewCookie(JSON.stringify(old))).toEqual(old);
    expect(decodePreviewCookie('{"a":1}')).toEqual({ a: 1 });
  });

  it.each([
    ["empty string", ""],
    ["garbage", "not a cookie"],
    ["prefix only", "b64."],
    ["invalid base64", "b64.@@@@"],
    ["truncated payload", encodePreviewCookie(preview("x")).slice(0, 20)],
    ["bytes that are not UTF-8", "b64." + btoa(String.fromCharCode(0xff, 0xfe, 0xfd)).replace(/=+$/, "")],
    ["a number", "1"],
    ["an array", "[1,2]"],
    ["null", "null"],
    ["a string", '"hello"'],
    ["a number inside the new format", "b64." + btoa("1").replace(/=+$/, "")],
  ])("returns null for %s (the cookie is client-controlled)", (_label, raw) => {
    expect(decodePreviewCookie(raw)).toBeNull();
  });
});
