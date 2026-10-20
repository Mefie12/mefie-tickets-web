"use client";

import Link from "next/link";
import { Card, type CardProps } from "@mantine/core";

/**
 * Same reasoning as LinkButton — see that file's comment.
 *
 * Cards are list items (events, series, tickets…), so they do not prefetch by default: with
 * `loading.tsx` in place, Next prefetches dynamic routes, and prefetching a card that leads into a new
 * event layout runs that layout's API calls — one per visible card, on page load. Pass `prefetch` to opt in.
 */
export function LinkCard({
  href,
  children,
  prefetch = false,
  ...props
}: CardProps & { href: string; children?: React.ReactNode; prefetch?: boolean }) {
  return (
    <Card component={Link} href={href} prefetch={prefetch} {...props}>
      {children}
    </Card>
  );
}
