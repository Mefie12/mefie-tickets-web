import { redirect } from "next/navigation";

/** Discover is the landing page now — see docs/14_venue_city_search_calendars_maps_plan.md and the Discover Events Figma redesign. */
export default function Home(): never {
  redirect("/discover");
}
