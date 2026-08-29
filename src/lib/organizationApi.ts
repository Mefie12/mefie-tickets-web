import { ApiError } from "@/lib/authApi";

export type OrganizationAddress = {
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
};

export type Organization = {
  id: string;
  slug: string;
  public_url_locked_at: string | null;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  description: string | null;
  logo_path: string | null;
  cover_image_path: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  address: OrganizationAddress | null;
  /** Whether tax / the platform fee / the card processing fee are charged to the buyer (true, default) or absorbed from this organization's payout. */
  tax_pass_through: boolean;
  fee_pass_through: boolean;
  processing_fee_pass_through: boolean;
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
    throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);
  }

  return data as T;
}

export function getOrganization() {
  return request<{ organization: Organization }>("/api/organization");
}

export type FeeSchedule = {
  currency: string;
  tax_basis_points: number;
  platform_fee_basis_points: number;
  processing_fee_basis_points: number;
  processing_fee_flat_minor: number;
};

/**
 * The current platform fee/tax/processing rates for this org's currency —
 * powers the "what this costs" figures next to the pass-through toggles.
 * These are the current rates; each event freezes its own copy at publish.
 */
export function getOrganizationFeeSchedule() {
  return request<{ fee_schedule: FeeSchedule }>("/api/organization/fee-schedule");
}

export function updateOrganization(input: {
  name?: string;
  email?: string;
  phone?: string | null;
  description?: string | null;
  address?: Partial<OrganizationAddress>;
  tax_pass_through?: boolean;
  fee_pass_through?: boolean;
  processing_fee_pass_through?: boolean;
}) {
  return request<{ organization: Organization }>("/api/organization", { method: "PATCH", body: input });
}

/**
 * Kept distinct from updateOrganization on purpose — the slug is
 * immutable through normal profile edits, changing it is a deliberate,
 * separate action (see the backend's ChangeOrganizationSlugAction).
 */
export function changeOrganizationSlug(slug: string) {
  return request<{ organization: Organization }>("/api/organization/slug", { method: "PATCH", body: { slug } });
}

async function uploadImage(path: string, fieldName: string, file: File): Promise<{ organization: Organization }> {
  const formData = new FormData();
  formData.append(fieldName, file);

  const res = await fetch(path, { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data?.message ?? "Upload failed.", res.status, data?.errors, data?.code);
  }

  return data as { organization: Organization };
}

export function uploadOrganizationLogo(file: File) {
  return uploadImage("/api/organization/logo", "logo", file);
}

export function uploadOrganizationCoverImage(file: File) {
  return uploadImage("/api/organization/cover-image", "cover_image", file);
}
