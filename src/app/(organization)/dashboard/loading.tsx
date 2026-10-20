import { ConsolePageSkeleton } from "@/components/console";

/** Shown instantly while this page's server data loads — see ConsolePageSkeleton. */
export default function Loading() {
  return <ConsolePageSkeleton variant="cards" />;
}
