import { ApiError } from "@/lib/authApi";

export type OrganizerAddress = {
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
};

export type Organizer = {
  id: number;
  account_id: number;
  name: string;
  slug: string;
  email: string;
  description: string | null;
  logo_path: string | null;
  cover_image_path: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  address: OrganizerAddress | null;
  /** Whether tax/the platform fee are charged to the buyer (true, default) or absorbed from this organizer's payout. */
  tax_pass_through: boolean;
  fee_pass_through: boolean;
};

async function request<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors);
  }

  return data as T;
}

export function listOrganizers() {
  return request<{ organizers: Organizer[] }>("/api/organizers");
}

export function getOrganizer(id: number) {
  return request<{ organizer: Organizer }>(`/api/organizers/${id}`);
}

export function createOrganizer(input: {
  name: string;
  email: string;
  description?: string;
  address?: Partial<OrganizerAddress>;
}) {
  return request<{ organizer: Organizer }>("/api/organizers", { method: "POST", body: input });
}

export function updateOrganizer(
  id: number,
  input: {
    name?: string;
    email?: string;
    description?: string | null;
    address?: Partial<OrganizerAddress>;
    tax_pass_through?: boolean;
    fee_pass_through?: boolean;
  },
) {
  return request<{ organizer: Organizer }>(`/api/organizers/${id}`, { method: "PATCH", body: input });
}

async function uploadImage(path: string, fieldName: string, file: File): Promise<{ organizer: Organizer }> {
  const formData = new FormData();
  formData.append(fieldName, file);

  const res = await fetch(path, { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data?.message ?? "Upload failed.", res.status, data?.errors);
  }

  return data as { organizer: Organizer };
}

export function uploadOrganizerLogo(id: number, file: File) {
  return uploadImage(`/api/organizers/${id}/logo`, "logo", file);
}

export function uploadOrganizerCoverImage(id: number, file: File) {
  return uploadImage(`/api/organizers/${id}/cover-image`, "cover_image", file);
}
