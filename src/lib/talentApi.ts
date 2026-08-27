import { ApiError } from "@/lib/authApi";

export type TalentRole =
  | "DJ" | "MUSICIAN" | "BAND" | "SPEAKER" | "CHEF" | "COMEDIAN"
  | "HOST_MC" | "DANCER" | "ACTOR" | "VISUAL_ARTIST" | "OTHER";

export type SocialLinkProvider = "WEBSITE" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "SPOTIFY" | "SOUNDCLOUD" | "FACEBOOK" | "X";

export type SocialLink = { provider: SocialLinkProvider; url: string };

export type TalentProfileVersion = {
  id: number;
  version_number: number;
  display_name: string;
  role: TalentRole;
  custom_role: string | null;
  tagline: string | null;
  biography: string | null;
  social_links: SocialLink[] | null;
  profile_image_url: string | null;
};

export type TalentProfile = {
  id: number;
  organization_id: string;
  status: "ACTIVE" | "ARCHIVED";
  current_version_id: number;
  current_version: TalentProfileVersion;
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
  if (!res.ok) throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);
  return data as T;
}

export function listTalentProfiles() {
  return request<{ talent_profiles: TalentProfile[] }>("/api/organization/talent");
}

export function createTalentProfile(input: {
  display_name: string;
  role: TalentRole;
  custom_role?: string | null;
  tagline?: string | null;
  biography?: string | null;
  social_links?: SocialLink[] | null;
}) {
  return request<{ talent_profile: TalentProfile }>("/api/organization/talent", { method: "POST", body: input });
}

export function updateTalentProfile(
  talentProfileId: number,
  input: Partial<{
    display_name: string;
    role: TalentRole;
    custom_role: string | null;
    tagline: string | null;
    biography: string | null;
    social_links: SocialLink[] | null;
  }>,
) {
  return request<{ talent_profile: TalentProfile }>(`/api/organization/talent/${talentProfileId}`, {
    method: "PATCH",
    body: input,
  });
}

export function archiveTalentProfile(talentProfileId: number) {
  return request<{ talent_profile: TalentProfile }>(`/api/organization/talent/${talentProfileId}/archive`, { method: "POST" });
}

export async function uploadTalentProfileImage(talentProfileId: number, file: File) {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(`/api/organization/talent/${talentProfileId}/image`, { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.message ?? "Upload failed.", res.status, data?.errors, data?.code);
  return data as { talent_profile: TalentProfile };
}
