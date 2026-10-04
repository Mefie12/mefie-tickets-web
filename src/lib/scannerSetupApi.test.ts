import { describe, expect, it } from "vitest";
import { scannerSetupLabel, type ScannerSetupStatus } from "@/lib/scannerSetupApi";

describe("scannerSetupLabel", () => {
  it("has a distinct, human label for every status — an expired link is not 'event closed'", () => {
    const statuses: ScannerSetupStatus[] = ["AVAILABLE", "CONSUMED", "REVOKED", "EXPIRED", "EVENT_CLOSED"];
    const labels = statuses.map(scannerSetupLabel);

    expect(new Set(labels).size).toBe(statuses.length);
    expect(scannerSetupLabel("EXPIRED")).toBe("Expired");
    expect(scannerSetupLabel("EVENT_CLOSED")).toBe("Event closed");
  });
});
