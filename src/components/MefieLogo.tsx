"use client";

import { Box, Image, useComputedColorScheme } from "@mantine/core";

/**
 * The platform wordmark — navy ink on light backgrounds, recolored to
 * white for dark ones (the source art has no dark-mode variant, so the
 * navy reads as near-invisible against a dark app background).
 *
 * The wrapper `Box` matters: Mantine's Image sets `flex: 0 1 0%` on the
 * `<img>` itself, so an `h`-only (no `w`) instance placed directly inside
 * a `Stack` (default `align="stretch"`) gets its cross-size stretched by
 * the parent flexbox before the intrinsic-ratio auto-width ever applies,
 * blowing the logo up to whatever the stretched width's aspect-ratio-
 * derived height comes out to. A plain block box keeps that flex
 * algorithm from ever reaching the `<img>`, regardless of what layout
 * (Stack, Group, Flex...) the caller nests this in. It has to be `block`,
 * not `inline-block` — `inline-block` keeps the wrapper (and the `<a>`
 * around it, e.g. in the header) in normal inline flow, where the image's
 * default baseline `vertical-align` leaves descender-height slack below
 * it, so a flex row centering that taller box visibly pushes the logo
 * above the true center (this is what caused the header/burger mismatch).
 */
export function MefieLogo({ h = 28 }: { h?: number }) {
  const colorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const src = colorScheme === "dark" ? "/images/mefie-logo-dark.png" : "/images/mefie-logo.png";

  return (
    <Box display="block">
      <Image src={src} alt="Mefie Tickets" h={h} w="auto" fit="contain" />
    </Box>
  );
}
