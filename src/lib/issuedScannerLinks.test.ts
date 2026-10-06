import { describe, expect, it } from "vitest";
import { addIssuedLink, dismissIssuedLink, MAX_ISSUED_LINKS, type IssuedLink } from "@/lib/issuedScannerLinks";

const link = (setupId: string, url = `https://x/gate/setup#${setupId}`): IssuedLink => ({
  setupId, heading: `Scanner ${setupId}`, message: "m", failed: false, url, qr: "data:image/png;base64,x",
});

describe("issued scanner links", () => {
  it("keeps earlier links when another scanner is created, newest first", () => {
    const list = addIssuedLink(addIssuedLink([], link("a")), link("b"));

    expect(list.map((item) => item.setupId)).toEqual(["b", "a"]);
  });

  it("replaces a setup's old link when it is re-issued, since the old token is dead", () => {
    const list = addIssuedLink(addIssuedLink(addIssuedLink([], link("a", "old")), link("b")), link("a", "new"));

    expect(list.map((item) => item.setupId)).toEqual(["a", "b"]);
    expect(list[0].url).toBe("new");
  });

  it("caps how many are kept and lets the organizer dismiss one", () => {
    let list: IssuedLink[] = [];
    for (let index = 0; index < MAX_ISSUED_LINKS + 3; index += 1) list = addIssuedLink(list, link(String(index)));

    expect(list).toHaveLength(MAX_ISSUED_LINKS);
    expect(list[0].setupId).toBe(String(MAX_ISSUED_LINKS + 2));
    expect(dismissIssuedLink(list, list[0].setupId)).toHaveLength(MAX_ISSUED_LINKS - 1);
  });
});
