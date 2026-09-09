import { ApiError } from "@/lib/authApi";

export type TalentRole =
  | "HEADLINER" | "SUPPORT_ACT" | "PERFORMER" | "DJ" | "MUSICIAN" | "VOCALIST"
  | "BAND" | "PRODUCER" | "DANCER" | "COMEDIAN" | "MAGICIAN" | "POET" | "ACTOR"
  | "VISUAL_ARTIST" | "HOST_MC" | "SPEAKER" | "KEYNOTE" | "MODERATOR"
  | "PANELIST" | "FACILITATOR" | "CHEF" | "GUEST" | "OTHER";

/**
 * Single source of truth for the talent-role dropdown — the organizer
 * lineup editor (`ContentSectionsEditor`) and the public event page
 * (`PublicContentSections`) both derive their option/label maps from this.
 * Mirrors `App\Enums\TalentRole` on the API. Alphabetical by label;
 * `OTHER` kept last as the catch-all.
 */
export const TALENT_ROLES: { value: TalentRole; label: string }[] = [
  { value: "ACTOR", label: "Actor" },
  { value: "BAND", label: "Band / group" },
  { value: "CHEF", label: "Chef" },
  { value: "COMEDIAN", label: "Comedian" },
  { value: "DANCER", label: "Dancer" },
  { value: "DJ", label: "DJ" },
  { value: "GUEST", label: "Guest" },
  { value: "HEADLINER", label: "Headliner" },
  { value: "HOST_MC", label: "Host / MC" },
  { value: "KEYNOTE", label: "Keynote speaker" },
  { value: "MAGICIAN", label: "Magician" },
  { value: "MODERATOR", label: "Moderator" },
  { value: "MUSICIAN", label: "Musician" },
  { value: "PANELIST", label: "Panelist" },
  { value: "PERFORMER", label: "Performer" },
  { value: "POET", label: "Poet / spoken word" },
  { value: "PRODUCER", label: "Producer" },
  { value: "SPEAKER", label: "Speaker" },
  { value: "SUPPORT_ACT", label: "Support act" },
  { value: "VISUAL_ARTIST", label: "Visual artist" },
  { value: "VOCALIST", label: "Vocalist / singer" },
  { value: "FACILITATOR", label: "Workshop facilitator" },
  { value: "OTHER", label: "Other" },
];

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
