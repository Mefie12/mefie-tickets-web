"use client";

import Link from "next/link";
import { Card, type CardProps } from "@mantine/core";

/**
 * Same reasoning as LinkButton — see that file's comment.
 */
export function LinkCard({ href, children, ...props }: CardProps & { href: string; children?: React.ReactNode }) {
  return (
    <Card component={Link} href={href} {...props}>
      {children}
    </Card>
  );
}
