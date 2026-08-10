"use client";

import Link from "next/link";
import { Button, type ButtonProps } from "@mantine/core";

/**
 * Next.js 16 changed `next/link`'s Link export to a plain function,
 * which can no longer be passed as a prop (`component={Link}`) from a
 * Server Component into Mantine's polymorphic Button — React can't
 * serialize a bare function across that boundary. Importing Link
 * directly inside this Client Component sidesteps it entirely: only
 * the (serializable) props cross the boundary, not Link itself.
 * See https://github.com/orgs/mantinedev/discussions/8629.
 */
export function LinkButton({ href, children, ...props }: ButtonProps & { href: string; children?: React.ReactNode }) {
  return (
    <Button component={Link} href={href} {...props}>
      {children}
    </Button>
  );
}
