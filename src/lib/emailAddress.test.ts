import { describe, expect, it } from "vitest";
import { isValidEmail, parseEmailList, suggestEmailCorrection } from "./emailAddress";

describe("isValidEmail", () => {
  it("accepts ordinary addresses, ignoring surrounding spaces", () => {
    for (const email of ["volunteer@example.com", " ama.mensah+gate@mail.example.co.uk ", "a@b.io", "dev.mefie@gmail.com"]) {
      expect(isValidEmail(email), email).toBe(true);
    }
  });

  it("rejects what a person has typed so far, and obvious mistakes", () => {
    for (const email of ["", " ", "a", "a@", "a@b", "a@b.", "a@b.c", "@example.com", "a b@example.com", "a@@example.com", "a@exa mple.com", "a@.com", "a@example..com", "a@b@example.com"]) {
      expect(isValidEmail(email), email).toBe(false);
    }
  });

  it("rejects an address longer than the standard allows", () => {
    expect(isValidEmail(`${"a".repeat(250)}@example.com`)).toBe(false);
  });
});

describe("parseEmailList", () => {
  it("separates real addresses from the entries that are not, whatever separator was used", () => {
    expect(parseEmailList("a@x.com, b@y.org;c@z.io\nnot-an-email  d@w.com")).toEqual({
      valid: ["a@x.com", "b@y.org", "c@z.io", "d@w.com"],
      invalid: ["not-an-email"],
    });
  });

  it("drops duplicates ignoring case, keeps the first spelling, and handles empty input", () => {
    expect(parseEmailList("Ama@x.com ama@X.com AMA@x.com").valid).toEqual(["Ama@x.com"]);
    expect(parseEmailList("")).toEqual({ valid: [], invalid: [] });
    expect(parseEmailList(" , ; \n ")).toEqual({ valid: [], invalid: [] });
  });

  it("reports half-typed entries as invalid", () => {
    expect(parseEmailList("a@x.com b@y").invalid).toEqual(["b@y"]);
  });
});

describe("suggestEmailCorrection", () => {
  it("suggests the right domain for common typos and keeps the name part as typed", () => {
    expect(suggestEmailCorrection("ama@gmial.com")).toBe("ama@gmail.com");
    expect(suggestEmailCorrection("Ama.Mensah@gmail.con")).toBe("Ama.Mensah@gmail.com");
    expect(suggestEmailCorrection("ama@gmai.com")).toBe("ama@gmail.com");
    expect(suggestEmailCorrection("ama@yahooo.com")).toBe("ama@yahoo.com");
    expect(suggestEmailCorrection("ama@hotmial.com")).toBe("ama@hotmail.com");
    expect(suggestEmailCorrection("ama@outlok.com")).toBe("ama@outlook.com");
    expect(suggestEmailCorrection("ama@icloud.co")).toBe("ama@icloud.com");
  });

  it("stays quiet for correct addresses, other real providers and company domains", () => {
    for (const email of ["ama@gmail.com", "ama@GMAIL.COM", "ama@mail.com", "ama@ymail.com", "ama@live.com", "ama@proton.me", "ama@googlemail.com", "ama@mefietickets.com", "ama@university.edu.gh", "ama@yahoo.co.uk", "ama@hotmail.co.uk", "ama@outlook.de"]) {
      expect(suggestEmailCorrection(email), email).toBeNull();
    }
  });

  it("says nothing until the address is complete", () => {
    for (const email of ["", "ama", "ama@", "ama@gmial", "ama@gmial."]) expect(suggestEmailCorrection(email), email).toBeNull();
  });
});
