/**
 * Thin client for Mapbox's Geocoding API v6 forward-search — address
 * autocomplete only, no embedded map (`mapbox-gl` isn't a dependency).
 * Called directly from the browser with a PUBLIC, domain-restricted
 * access token — this is Mapbox's standard client-side pattern, not a
 * secret that needs a backend proxy.
 *
 * Response shape reference (verified against Mapbox's v6 docs): each
 * GeoJSON feature carries `geometry.coordinates` as [lng, lat] — note
 * the order, opposite of how coordinates are usually said aloud — and
 * a `properties.context` object keyed by place type (`country`,
 * `region`, `postcode`, `place`), each with its own `name`/`*_code`
 * fields (e.g. `context.country.country_code` is the ISO 3166-1
 * alpha-2 code). Not every key is present for every result (a rural
 * address may have no `region`), so every access below is optional.
 */

const GEOCODE_URL = "https://api.mapbox.com/search/geocode/v6/forward";

export type MapboxSuggestion = {
  /** Full display string for the dropdown row, e.g. "10 Downing St, London, UK". */
  displayLabel: string;
  latitude: number;
  longitude: number;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  /** ISO 3166-1 alpha-2, uppercased to match CountrySelector's stored format. */
  country: string | null;
};

type MapboxFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    full_address?: string;
    place_formatted?: string;
    context?: {
      country?: { name?: string; country_code?: string };
      region?: { name?: string; region_code?: string };
      postcode?: { name?: string };
      place?: { name?: string };
    };
  };
};

export function mapboxTokenConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
}

/**
 * A static preview image of the venue location — no `mapbox-gl`
 * dependency, just an `<img src>` built from the Static Images API,
 * using the same public token as the geocoder above (no new vendor).
 * Purely a visual preview: the actual "Get directions" action is a
 * separate Google Maps deep link (see the public event pages), which
 * this does not replace.
 */
export function staticMapImageUrl(
  latitude: number,
  longitude: number,
  options?: { width?: number; height?: number; zoom?: number },
): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  const width = options?.width ?? 600;
  const height = options?.height ?? 300;
  const zoom = options?.zoom ?? 14;
  const marker = `pin-l+552efd(${longitude},${latitude})`;

  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${marker}/${longitude},${latitude},${zoom}/${width}x${height}@2x?access_token=${token}`;
}

/**
 * Returns [] on any error (network failure, no token, empty query) —
 * callers treat an empty suggestion list as "nothing to show" rather
 * than a hard failure, since this is a convenience feature layered over
 * plain manual text entry, never a blocker to filling in the form.
 */
export async function geocodeAddress(query: string, countryIso2: string | null): Promise<MapboxSuggestion[]> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || query.trim().length < 3) return [];

  const params = new URLSearchParams({ q: query, access_token: token, limit: "5" });
  if (countryIso2) params.set("country", countryIso2.toLowerCase());

  try {
    const res = await fetch(`${GEOCODE_URL}?${params.toString()}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: MapboxFeature[] };
    return (data.features ?? []).map(mapFeatureToSuggestion).filter((s): s is MapboxSuggestion => s !== null);
  } catch {
    return [];
  }
}

function mapFeatureToSuggestion(feature: MapboxFeature): MapboxSuggestion | null {
  const [lng, lat] = feature.geometry?.coordinates ?? [];
  if (lng === undefined || lat === undefined) return null;

  const props = feature.properties ?? {};
  const context = props.context ?? {};

  return {
    displayLabel: props.full_address ?? [props.name, props.place_formatted].filter(Boolean).join(", "),
    latitude: lat,
    longitude: lng,
    address_line1: props.name ?? null,
    city: context.place?.name ?? null,
    state: context.region?.region_code ?? context.region?.name ?? null,
    postal_code: context.postcode?.name ?? null,
    country: context.country?.country_code?.toUpperCase() ?? null,
  };
}
