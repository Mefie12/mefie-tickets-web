"use client";

import Link from "next/link";
import { Anchor, type AnchorProps } from "@mantine/core";

/**
 * Same reasoning as LinkButton — see that file's comment. For inline
 * text links that need to be rendered from a Server Component.
 */
export function LinkAnchor({ href, children, ...props }: AnchorProps & { href: string; children?: React.ReactNode }) {
  return (
    <Anchor component={Link} href={href} {...props}>
      {children}
    </Anchor>
  );
}
