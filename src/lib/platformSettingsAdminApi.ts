import { ApiError } from "@/lib/authApi";

export type ReservationHoldMinutesSetting = {
  value: number;
  default: number;
  is_override: boolean;
};

export type PlatformSettings = {
  reservation_hold_minutes: ReservationHoldMinutesSetting;
};

async function request<T>(
  path: string,
  options: { method?: "GET" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);
  }

  return data as T;
}

export function getPlatformSettings() {
  return request<PlatformSettings>("/api/admin/platform-settings");
}

export function setReservationHoldMinutes(minutes: number) {
  return request<Pick<PlatformSettings, "reservation_hold_minutes">>("/api/admin/platform-settings/reservation-hold-minutes", {
    method: "PUT",
    body: { minutes },
  });
}

export function resetReservationHoldMinutes() {
  return request<Pick<PlatformSettings, "reservation_hold_minutes">>("/api/admin/platform-settings/reservation-hold-minutes", {
    method: "DELETE",
  });
}
