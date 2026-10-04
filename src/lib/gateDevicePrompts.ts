export type DeviceStatusTarget = "PAUSED" | "RETIRED";

const checkIns = (count: number) => `${count} check-in${count === 1 ? "" : "s"}`;

/**
 * The confirmation shown before pausing or retiring a scanner. The pending count is what the device last
 * REPORTED — a scanner that has been offline may hold more — and the two actions differ in the way that
 * matters: a paused scanner still uploads what it recorded, a retired one never will.
 */
export function deviceStatusPrompt(label: string | null, target: DeviceStatusTarget, pending: number | null): string {
  const name = label?.trim() || "this scanner";
  const waiting = pending && pending > 0 ? checkIns(pending) : null;

  if (target === "PAUSED") {
    return [
      `Pause ${name}?`,
      "It will stop admitting guests, and you can resume it at any time.",
      waiting
        ? `It last reported ${waiting} waiting to upload; those will still upload when it is online.`
        : "It last reported nothing waiting to upload.",
      "A scanner that is offline will not hear about the pause until it reconnects.",
    ].join("\n\n");
  }

  return [
    `Retire ${name}? This cannot be undone.`,
    "It loses all access immediately.",
    waiting
      ? `It last reported ${waiting} waiting to upload — retiring means they can never be uploaded from this device.`
      : "Check-ins still on the device that it has not reported can never be uploaded once it is retired.",
    "If you only need it to stop admitting guests, pause it instead. Retire a scanner you do not trust or have replaced.",
  ].join("\n\n");
}
