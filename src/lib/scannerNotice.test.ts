import { describe, expect, it } from "vitest";
import { scannerNoticeToast } from "@/lib/scannerNotice";

describe("scannerNoticeToast", () => {
  it("turns the API notice into a toast that stays up long enough to read", () => {
    const toast = scannerNoticeToast({ prepared_scanners: 2, message: "2 scanners already set up..." });

    expect(toast).toMatchObject({ color: "orange", message: "2 scanners already set up..." });
    expect(toast!.autoClose).toBeGreaterThanOrEqual(10_000);
  });

  it("says nothing when there is no notice or no prepared scanners", () => {
    expect(scannerNoticeToast(undefined)).toBeNull();
    expect(scannerNoticeToast(null)).toBeNull();
    expect(scannerNoticeToast({ prepared_scanners: 0, message: "x" })).toBeNull();
  });
});
